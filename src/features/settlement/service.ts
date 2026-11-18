import type { PrismaClient } from "@/generated/prisma/client";
import { appError, type AppError } from "@/lib/appError";
import { isCurrencyCode } from "@/lib/currency";
import type { Money } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { idSchema, parseWith } from "@/lib/validation";
import { addSettlementGroupSchema, addSettlementSchema } from "./schema";

/**
 * A recorded payment, shaped for the balance (never the raw DB row): `fromId`
 * paid `toId` `amount`. Same fields as the balance lib's `Transfer`.
 */
export type Settlement = Readonly<{
  id: string;
  fromId: string;
  toId: string;
  amount: Money;
}>;

const NOT_A_MEMBER = "Choose a member of this group";

/** Logs the details on the server; the caller only ever sees a generic message. */
function unexpected(context: string, error: unknown): AppError {
  console.error(`[settlement] ${context}:`, error);
  return appError("UNEXPECTED", "Something went wrong. Please try again.");
}

function unsupportedCurrency(groupId: string, currency: string): AppError {
  return unexpected(
    `stored currency is not supported (group ${groupId})`,
    new Error(`Unsupported currency: ${currency}`),
  );
}

/**
 * Validates, then checks that both members belong to THIS group (the ids come
 * from hidden form fields and are untrusted), then inserts. One interactive
 * transaction, like addExpense, so the currency read, the membership check
 * and the insert see the same data. A member's groupId never changes, and a
 * member with a settlement can't be deleted (FK Restrict), so the check
 * cannot go stale. Same member, amount <= 0 or above the cap -> VALIDATION.
 */
export async function addSettlement(
  db: PrismaClient,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const target = parseWith(addSettlementGroupSchema, input);
  if (!target.ok) return target;
  const { groupId } = target.value;

  try {
    return await db.$transaction(
      async (tx): Promise<Result<{ id: string }>> => {
        const group = await tx.group.findUnique({
          where: { id: groupId },
          select: { currency: true },
        });
        if (!group) return fail(appError("NOT_FOUND", "Group not found"));
        if (!isCurrencyCode(group.currency)) {
          return fail(unsupportedCurrency(groupId, group.currency));
        }

        const parsed = parseWith(addSettlementSchema(group.currency), input);
        if (!parsed.ok) return parsed;
        const { fromId, toId, amount } = parsed.value;

        // Scoped by groupId: a member of another group is not found here.
        const found = await tx.member.findMany({
          where: { groupId, id: { in: [fromId, toId] } },
          select: { id: true },
        });
        const members = new Set(found.map((row) => row.id));
        const fields: Record<string, string> = {};
        if (!members.has(fromId)) fields.fromId = NOT_A_MEMBER;
        if (!members.has(toId)) fields.toId = NOT_A_MEMBER;
        if (Object.keys(fields).length > 0) {
          return fail(appError("VALIDATION", "Invalid input", fields));
        }

        const row = await tx.settlement.create({
          data: { groupId, fromId, toId, amount: amount.amount },
          select: { id: true },
        });
        return ok({ id: row.id });
      },
    );
  } catch (error) {
    return fail(unexpected("addSettlement failed", error));
  }
}

/** Settlements of one group, newest first. Malformed id -> VALIDATION. */
export async function listSettlements(
  db: PrismaClient,
  input: unknown,
): Promise<Result<Settlement[]>> {
  const groupId = parseWith(idSchema, input);
  if (!groupId.ok) return groupId;

  try {
    const rows = await db.settlement.findMany({
      where: { groupId: groupId.value },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        fromId: true,
        toId: true,
        amount: true,
        group: { select: { currency: true } },
      },
    });

    const settlements: Settlement[] = [];
    for (const row of rows) {
      const currency = row.group.currency;
      if (!isCurrencyCode(currency)) {
        return fail(unsupportedCurrency(groupId.value, currency));
      }
      settlements.push({
        id: row.id,
        fromId: row.fromId,
        toId: row.toId,
        amount: { amount: row.amount, currency },
      });
    }
    return ok(settlements);
  } catch (error) {
    return fail(unexpected("listSettlements failed", error));
  }
}

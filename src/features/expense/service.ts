import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { appError, type AppError } from "@/lib/appError";
import { isCurrencyCode } from "@/lib/currency";
import type { Money } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { idSchema, parseWith } from "@/lib/validation";
import { addExpenseGroupSchema, addExpenseSchema } from "./schema";

/** What callers get back: shaped for the UI, never the raw DB row. */
export type ExpenseMember = Readonly<{ id: string; name: string }>;
export type Expense = Readonly<{
  id: string;
  description: string | null;
  amount: Money;
  payer: ExpenseMember;
  participants: readonly ExpenseMember[];
}>;

const memberSelect = { id: true, name: true } as const;

/** Logs the details on the server; the caller only ever sees a generic message. */
function unexpected(context: string, error: unknown): AppError {
  console.error(`[expense] ${context}:`, error);
  return appError("UNEXPECTED", "Something went wrong. Please try again.");
}

function unsupportedCurrency(groupId: string, currency: string): AppError {
  return unexpected(
    `stored currency is not supported (group ${groupId})`,
    new Error(`Unsupported currency: ${currency}`),
  );
}

/**
 * Validates, then checks that the payer and every participant are members of
 * THIS group (ids come from the form and are untrusted), then inserts the
 * expense and its participants. Everything runs in one interactive
 * transaction: any failure after the expense row is written rolls it back.
 * A member's groupId never changes, so the membership check cannot go stale;
 * a member removed meanwhile fails the FK (Restrict) and rolls back too.
 */
export async function addExpense(
  db: PrismaClient,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const target = parseWith(addExpenseGroupSchema, input);
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

        const parsed = parseWith(addExpenseSchema(group.currency), input);
        if (!parsed.ok) return parsed;
        const { payerId, participantIds, amount, description } = parsed.value;

        const notInGroup = await findNonMembers(tx, groupId, [
          payerId,
          ...participantIds,
        ]);
        const fields: Record<string, string> = {};
        if (notInGroup.has(payerId)) {
          fields.payerId = "Choose a member of this group";
        }
        if (participantIds.some((id) => notInGroup.has(id))) {
          fields.participantIds = "Choose only members of this group";
        }
        if (Object.keys(fields).length > 0) {
          return fail(appError("VALIDATION", "Invalid input", fields));
        }

        const expense = await tx.expense.create({
          data: { groupId, payerId, amount: amount.amount, description },
          select: { id: true },
        });
        await tx.expenseParticipant.createMany({
          data: participantIds.map((memberId) => ({
            expenseId: expense.id,
            memberId,
          })),
        });
        return ok({ id: expense.id });
      },
    );
  } catch (error) {
    return fail(unexpected("addExpense failed", error));
  }
}

/** Ids (at most PARTICIPANTS_MAX + 1, bounded by the schema) that are not members of `groupId`. */
async function findNonMembers(
  tx: Prisma.TransactionClient,
  groupId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(ids)];
  const found = await tx.member.findMany({
    where: { groupId, id: { in: unique } },
    select: { id: true },
  });
  const members = new Set(found.map((row) => row.id));
  return new Set(unique.filter((id) => !members.has(id)));
}

/** Expenses of one group, newest first; participants in member order. Malformed id -> VALIDATION. */
export async function listExpenses(
  db: PrismaClient,
  input: unknown,
): Promise<Result<Expense[]>> {
  const groupId = parseWith(idSchema, input);
  if (!groupId.ok) return groupId;

  try {
    const rows = await db.expense.findMany({
      where: { groupId: groupId.value },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        amount: true,
        description: true,
        group: { select: { currency: true } },
        payer: { select: memberSelect },
        participants: {
          orderBy: [{ member: { createdAt: "asc" } }, { memberId: "asc" }],
          select: { member: { select: memberSelect } },
        },
      },
    });

    const expenses: Expense[] = [];
    for (const row of rows) {
      const currency = row.group.currency;
      if (!isCurrencyCode(currency)) {
        return fail(unsupportedCurrency(groupId.value, currency));
      }
      expenses.push({
        id: row.id,
        description: row.description,
        amount: { amount: row.amount, currency },
        payer: { id: row.payer.id, name: row.payer.name },
        participants: row.participants.map(({ member }) => ({
          id: member.id,
          name: member.name,
        })),
      });
    }
    return ok(expenses);
  } catch (error) {
    return fail(unexpected("listExpenses failed", error));
  }
}

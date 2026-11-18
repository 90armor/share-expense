import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { appError, type AppError } from "@/lib/appError";
import { fail, ok, type Result } from "@/lib/result";
import { idSchema, parseWith } from "@/lib/validation";
import { addMemberSchema, memberNameKey, removeMemberSchema } from "./schema";

/** What callers get back: shaped for the UI, never the raw DB row. */
export type Member = Readonly<{ id: string; name: string }>;

const memberSelect = { id: true, name: true } as const;

/** Logs the details on the server; the caller only ever sees a generic message. */
function unexpected(context: string, error: unknown): AppError {
  console.error(`[member] ${context}:`, error);
  return appError("UNEXPECTED", "Something went wrong. Please try again.");
}

/**
 * True only for a unique violation on Member(groupId, nameKey). Shape checked
 * against Prisma 7.10.1 + the better-sqlite3 adapter (meta.driverAdapterError).
 * Any other unique violation stays UNEXPECTED.
 */
function isNameKeyConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const meta = error.meta as
    | {
        modelName?: unknown;
        driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
      }
    | undefined;
  const fields = meta?.driverAdapterError?.cause?.constraint?.fields;
  return (
    meta?.modelName === "Member" &&
    Array.isArray(fields) &&
    fields.length === 2 &&
    fields[0] === "groupId" &&
    fields[1] === "nameKey"
  );
}

/**
 * True only for a foreign-key violation (P2003) on a Member delete. Shape
 * checked against Prisma 7.10.1 + the better-sqlite3 adapter:
 * meta.modelName "Member", meta.driverAdapterError.cause.kind
 * "ForeignKeyConstraintViolation". SQLite does not name the key. Member is
 * referenced by Expense.payerId, ExpenseParticipant.memberId,
 * Settlement.fromId and Settlement.toId, so this means "paid for or shares an
 * expense, or paid or received a settlement". The CONFLICT message names only
 * expenses: through the UI, a member in a settlement always has an expense
 * (docs/decisions.md).
 */
function isMemberInUse(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2003") return false;
  const meta = error.meta as
    | {
        modelName?: unknown;
        driverAdapterError?: { cause?: { kind?: unknown } };
      }
    | undefined;
  return (
    meta?.modelName === "Member" &&
    meta?.driverAdapterError?.cause?.kind === "ForeignKeyConstraintViolation"
  );
}

/** Validates, checks the group exists, then inserts. Same name (by key) in the group -> CONFLICT. */
export async function addMember(
  db: PrismaClient,
  input: unknown,
): Promise<Result<Member>> {
  const parsed = parseWith(addMemberSchema, input);
  if (!parsed.ok) return parsed;
  const { groupId, name } = parsed.value;

  try {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) return fail(appError("NOT_FOUND", "Group not found"));

    // The DB unique index decides duplicates, so two concurrent adds cannot both win.
    const row = await db.member.create({
      data: { groupId, name, nameKey: memberNameKey(name) },
      select: memberSelect,
    });
    return ok({ id: row.id, name: row.name });
  } catch (error) {
    if (isNameKeyConflict(error)) {
      return fail(
        appError(
          "CONFLICT",
          `A member named “${name}” is already in this group.`,
        ),
      );
    }
    return fail(unexpected("addMember failed", error));
  }
}

/** Members of one group, oldest first. Malformed id -> VALIDATION. */
export async function listMembers(
  db: PrismaClient,
  input: unknown,
): Promise<Result<Member[]>> {
  const groupId = parseWith(idSchema, input);
  if (!groupId.ok) return groupId;

  try {
    const rows = await db.member.findMany({
      where: { groupId: groupId.value },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: memberSelect,
    });
    return ok(rows.map((row) => ({ id: row.id, name: row.name })));
  } catch (error) {
    return fail(unexpected("listMembers failed", error));
  }
}

/**
 * Deletes the member only if it belongs to `groupId` (one statement, so there
 * is no check-then-delete gap). A member of another group -> NOT_FOUND.
 * A member who paid for or shares an expense, or paid or received a
 * settlement -> CONFLICT: the FK (Restrict) refuses the delete, so the DB
 * decides and no expense or settlement can slip in between.
 */
export async function removeMember(
  db: PrismaClient,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = parseWith(removeMemberSchema, input);
  if (!parsed.ok) return parsed;
  const { groupId, memberId } = parsed.value;

  try {
    const { count } = await db.member.deleteMany({
      where: { id: memberId, groupId },
    });
    if (count === 0) return fail(appError("NOT_FOUND", "Member not found"));
    return ok({ id: memberId });
  } catch (error) {
    if (isMemberInUse(error)) {
      return fail(
        appError(
          "CONFLICT",
          "This member paid for or shares an expense and can't be removed.",
        ),
      );
    }
    return fail(unexpected("removeMember failed", error));
  }
}

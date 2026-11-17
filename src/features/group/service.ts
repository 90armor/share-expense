import type { PrismaClient } from "@/generated/prisma/client";
import { appError, type AppError } from "@/lib/appError";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { fail, ok, type Result } from "@/lib/result";
import { idSchema, parseWith } from "@/lib/validation";
import { createGroupSchema } from "./schema";

/** What callers get back: shaped for the UI, never the raw DB row. */
export type Group = Readonly<{
  id: string;
  name: string;
  currency: CurrencyCode;
}>;

type GroupRow = { id: string; name: string; currency: string };

/** Logs the details on the server; the caller only ever sees a generic message. */
function unexpected(context: string, error: unknown): AppError {
  console.error(`[group] ${context}:`, error);
  return appError("UNEXPECTED", "Something went wrong. Please try again.");
}

function toGroup(row: GroupRow): Result<Group> {
  if (!isCurrencyCode(row.currency)) {
    return fail(
      unexpected(
        `stored currency is not supported (group ${row.id})`,
        new Error(`Unsupported currency: ${row.currency}`),
      ),
    );
  }
  return ok({ id: row.id, name: row.name, currency: row.currency });
}

/** Validates untrusted input, then inserts. Never throws for expected failures. */
export async function createGroup(
  db: PrismaClient,
  input: unknown,
): Promise<Result<Group>> {
  const parsed = parseWith(createGroupSchema, input);
  if (!parsed.ok) return parsed;

  try {
    const row = await db.group.create({ data: parsed.value });
    return toGroup(row);
  } catch (error) {
    return fail(unexpected("createGroup failed", error));
  }
}

/** Validates the id (malformed -> VALIDATION), then reads (missing -> NOT_FOUND). */
export async function getGroup(
  db: PrismaClient,
  input: unknown,
): Promise<Result<Group>> {
  const id = parseWith(idSchema, input);
  if (!id.ok) return id;

  try {
    const row = await db.group.findUnique({ where: { id: id.value } });
    if (!row) return fail(appError("NOT_FOUND", "Group not found"));
    return toGroup(row);
  } catch (error) {
    return fail(unexpected("getGroup failed", error));
  }
}

import { z } from "zod";
import { appError } from "./appError";
import { CURRENCY_CODES, type CurrencyCode } from "./currency";
import { parseAmount } from "./money";
import { fail, ok, type Result } from "./result";

export const NAME_MAX_LENGTH = 100;
export const ID_MAX_LENGTH = 64;

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`);

/** Generic for now; tighten once the first Prisma model picks cuid/uuid. */
export const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required")
  .max(ID_MAX_LENGTH, `ID must be at most ${ID_MAX_LENGTH} characters`);

export const currencyCodeSchema = z.enum(
  CURRENCY_CODES,
  "Unsupported currency",
);

/** Amount string (e.g. "1,234.50") -> Money. Accepts 0; features add their own > 0 rule. */
export function moneyAmountSchema(currency: CurrencyCode) {
  return z.string("Amount must be text").transform((input, ctx) => {
    const result = parseAmount(input, currency);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error.message });
      return z.NEVER;
    }
    return result.value;
  });
}

const ROOT_FIELD = "_root";

/** Runs a schema and returns a Result; failures become VALIDATION with a field -> message map. */
export function parseWith<S extends z.ZodType>(
  schema: S,
  input: unknown,
): Result<z.output<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);

  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key =
      issue.path.length > 0 ? issue.path.map(String).join(".") : ROOT_FIELD;
    fields[key] ??= issue.message;
  }
  return fail(appError("VALIDATION", "Invalid input", fields));
}

import { z } from "zod";
import { appError } from "./appError";
import { CURRENCY_CODES, type CurrencyCode } from "./currency";
import { AMOUNT_MAX_MINOR_UNITS, NAME_MAX_CODE_UNITS_PER_CHAR } from "./limits";
import { formatAmount, parseAmount } from "./money";
import { fail, ok, type Result } from "./result";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Visible characters: "ကို" is 3 UTF-16 code units but 1 grapheme. */
function graphemeCount(text: string): number {
  return Array.from(graphemes.segment(text)).length;
}

/**
 * Trimmed, non-blank name of at most `maxLength` visible characters
 * (graphemes). The code-unit backstop runs first and aborts, so a huge string
 * is never segmented.
 */
export function nameSchema(maxLength: number) {
  const tooLong = `Name must be at most ${maxLength} characters`;
  return z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(maxLength * NAME_MAX_CODE_UNITS_PER_CHAR, {
      message: tooLong,
      abort: true,
    })
    .refine((name) => graphemeCount(name) <= maxLength, tooLong);
}

/**
 * Row ids are UUID v4 (Prisma `@default(uuid(4))`): random, so a URL cannot be
 * guessed. Strict: other versions (v1/v7 are time-based), nil and whitespace fail.
 */
export const idSchema = z.uuidv4("Invalid ID");

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

/**
 * An amount that moves money (expense, settlement): `moneyAmountSchema`, then
 * more than 0 and at most `AMOUNT_MAX_MINOR_UNITS` (see limits.ts).
 */
export function positiveAmountSchema(currency: CurrencyCode) {
  return moneyAmountSchema(currency)
    .refine((money) => money.amount > 0n, "Amount must be more than 0")
    .refine(
      (money) => money.amount <= AMOUNT_MAX_MINOR_UNITS,
      `Amount must be at most ${formatAmount({ amount: AMOUNT_MAX_MINOR_UNITS, currency })}`,
    );
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
    if (!Object.hasOwn(fields, key)) fields[key] = issue.message;
  }
  return fail(appError("VALIDATION", "Invalid input", fields));
}

import { appError } from "./appError";
import type { CurrencyCode } from "./currency";
import { fail, ok, type Result } from "./result";

/**
 * Domain money value. `amount` is an integer count of minor units (1/100),
 * never a float. Travels across JSON/forms as a string, not as this object.
 */
export type Money = Readonly<{ amount: bigint; currency: CurrencyCode }>;

/** Largest value a signed 64-bit DB column (Prisma BigInt) can hold. */
const MAX_MINOR_UNITS = 9_223_372_036_854_775_807n;

// Integer part: "0", plain digits without a leading zero, or valid thousands grouping.
// Optional fraction: 1-2 digits.
const AMOUNT_PATTERN = /^(0|[1-9]\d{0,2}(,\d{3})+|[1-9]\d*)(\.\d{1,2})?$/;
const TOO_MANY_DECIMALS_PATTERN = /^[\d,]*\.\d{3,}$/;

function invalid(message: string): Result<Money> {
  return fail(appError("VALIDATION", message));
}

/** Parses a user-entered amount like "1,234.5" into minor units. */
export function parseAmount(
  input: string,
  currency: CurrencyCode,
): Result<Money> {
  const text = input.trim();
  if (text === "") return invalid("Amount is required");
  if (text.startsWith("-")) return invalid("Amount cannot be negative");
  if (!AMOUNT_PATTERN.test(text)) {
    if (TOO_MANY_DECIMALS_PATTERN.test(text))
      return invalid("At most 2 decimal places");
    return invalid("Enter a valid amount, e.g. 1,234.50");
  }

  const [integerPart, fractionPart = ""] = text.replace(/,/g, "").split(".");
  const amount = BigInt(integerPart + fractionPart.padEnd(2, "0"));
  if (amount > MAX_MINOR_UNITS) return invalid("Amount is too large");

  return ok({ amount, currency });
}

/** "1,234.50" / "-0.05". No Intl: exact for any bigint and identical on server and browser. */
export function formatAmount(money: Money): string {
  const negative = money.amount < 0n;
  const abs = negative ? -money.amount : money.amount;
  const integerPart = (abs / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fractionPart = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${integerPart}.${fractionPart}`;
}

/** "MMK 1,234.50" */
export function formatMoney(money: Money): string {
  return `${money.currency} ${formatAmount(money)}`;
}

/** Throws on mismatch: with one currency per group, mixing is a programmer bug. */
export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

/** `currency` is required so an empty list still has a currency. */
export function sumMoney(
  items: readonly Money[],
  currency: CurrencyCode,
): Money {
  return items.reduce<Money>(addMoney, { amount: 0n, currency });
}

export function negate(money: Money): Money {
  return { amount: -money.amount, currency: money.currency };
}

export function isZero(money: Money): boolean {
  return money.amount === 0n;
}

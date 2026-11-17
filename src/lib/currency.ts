export const CURRENCY_CODES = ["MMK", "USD", "KHR"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** Decimal places per currency. Minor unit = 1 / 10^exponent. */
export const CURRENCY_EXPONENT: Record<CurrencyCode, number> = {
  MMK: 2,
  USD: 2,
  KHR: 2,
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    (CURRENCY_CODES as readonly string[]).includes(value)
  );
}

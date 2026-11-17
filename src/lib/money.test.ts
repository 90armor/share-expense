import { describe, expect, it } from "vitest";
import type { CurrencyCode } from "./currency";
import {
  addMoney,
  assertSameCurrency,
  formatAmount,
  formatMoney,
  isZero,
  negate,
  parseAmount,
  subtractMoney,
  sumMoney,
  type Money,
} from "./money";

const mmk = (amount: bigint): Money => ({ amount, currency: "MMK" });
const usd = (amount: bigint): Money => ({ amount, currency: "USD" });

const INT64_MAX = 9_223_372_036_854_775_807n;

describe("parseAmount", () => {
  it.each([
    ["1,234.5", 123450n],
    ["1234", 123400n],
    ["0.05", 5n],
    ["0", 0n],
    ["0.5", 50n],
    ["10.5", 1050n],
    [" 12.30 ", 1230n],
    ["1,234,567.89", 123456789n],
    ["999,999,999.99", 99999999999n],
    ["92,233,720,368,547,758.07", INT64_MAX],
  ])("accepts %j", (input, expected) => {
    expect(parseAmount(input, "MMK")).toEqual({
      ok: true,
      value: { amount: expected, currency: "MMK" },
    });
  });

  it("keeps the requested currency", () => {
    expect(parseAmount("1", "KHR")).toEqual({
      ok: true,
      value: { amount: 100n, currency: "KHR" },
    });
  });

  it.each([
    "",
    "   ",
    "-1",
    "-0.01",
    "+1",
    ".5",
    "1.",
    "1.234",
    "0.001",
    "1e3",
    "1E3",
    "NaN",
    "Infinity",
    "abc",
    "12a",
    "MMK 12",
    "1,23",
    "1,2345",
    ",123",
    "123,",
    "1,234,56",
    "12 34",
    "007",
    "00",
    "00.5",
    "0,001",
    "0x10",
    "92,233,720,368,547,758.08",
  ])("rejects %j", (input) => {
    const result = parseAmount(input, "USD");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.message).not.toBe("");
    }
  });
});

describe("formatAmount / formatMoney", () => {
  it.each([
    [0n, "0.00"],
    [1n, "0.01"],
    [10n, "0.10"],
    [100n, "1.00"],
    [123450n, "1,234.50"],
    [100000n, "1,000.00"],
    [99999999999n, "999,999,999.99"],
    [INT64_MAX, "92,233,720,368,547,758.07"],
    [-5n, "-0.05"],
    [-1n, "-0.01"],
    [-100n, "-1.00"],
    [-123450n, "-1,234.50"],
  ])("formatAmount(%s) === %j", (amount, expected) => {
    expect(formatAmount(mmk(amount))).toBe(expected);
  });

  it("formatMoney shows the currency code with a plain space", () => {
    expect(formatMoney(mmk(123450n))).toBe("MMK 1,234.50");
    expect(formatMoney(usd(-123450n))).toBe("USD -1,234.50");
    expect(formatMoney({ amount: 0n, currency: "KHR" })).toBe("KHR 0.00");
  });

  it("negating zero never prints -0", () => {
    const negZero = negate(mmk(0n));
    expect(negZero.amount).toBe(0n);
    expect(formatAmount(negZero)).toBe("0.00");
    expect(formatMoney(negZero)).toBe("MMK 0.00");
  });
});

describe("round-trip parseAmount(formatAmount(x))", () => {
  const values: bigint[] = [
    0n,
    1n,
    10n,
    99n,
    100n,
    123450n,
    99999999999n, // 999,999,999.99
    2n ** 31n - 1n,
    2n ** 31n,
    2n ** 31n + 1n,
    500_000_000_000n, // 5,000,000,000.00 MMK
    2n ** 53n + 1n, // beyond Number.MAX_SAFE_INTEGER
    INT64_MAX,
  ];

  it.each(values)("round-trips %s minor units", (amount) => {
    const currencies: CurrencyCode[] = ["MMK", "USD", "KHR"];
    for (const currency of currencies) {
      const money: Money = { amount, currency };
      expect(parseAmount(formatAmount(money), currency)).toEqual({
        ok: true,
        value: money,
      });
    }
  });
});

describe("arithmetic", () => {
  it("addMoney / subtractMoney", () => {
    expect(addMoney(mmk(150n), mmk(250n))).toEqual(mmk(400n));
    expect(subtractMoney(mmk(150n), mmk(250n))).toEqual(mmk(-100n));
  });

  it("works above 2^53 without precision loss", () => {
    const big = mmk(2n ** 53n);
    expect(addMoney(big, mmk(1n))).toEqual(mmk(2n ** 53n + 1n));
  });

  it("sumMoney sums a list and returns zero for an empty list", () => {
    expect(sumMoney([mmk(1n), mmk(2n), mmk(3n)], "MMK")).toEqual(mmk(6n));
    expect(sumMoney([], "USD")).toEqual(usd(0n));
  });

  it("negate and isZero", () => {
    expect(negate(mmk(5n))).toEqual(mmk(-5n));
    expect(negate(mmk(-5n))).toEqual(mmk(5n));
    expect(isZero(mmk(0n))).toBe(true);
    expect(isZero(mmk(1n))).toBe(false);
    expect(isZero(mmk(-1n))).toBe(false);
  });
});

describe("mixed currencies", () => {
  it("assertSameCurrency throws on mismatch and passes on match", () => {
    expect(() => assertSameCurrency(mmk(1n), usd(1n))).toThrow(
      "Currency mismatch: MMK vs USD",
    );
    expect(() => assertSameCurrency(mmk(1n), mmk(2n))).not.toThrow();
  });

  it("addMoney / subtractMoney throw on mismatch", () => {
    expect(() => addMoney(mmk(1n), usd(1n))).toThrow("Currency mismatch");
    expect(() => subtractMoney(usd(1n), mmk(1n))).toThrow("Currency mismatch");
  });

  it("sumMoney throws when any item differs from the given currency", () => {
    expect(() => sumMoney([mmk(1n), usd(1n)], "MMK")).toThrow(
      "Currency mismatch",
    );
    expect(() => sumMoney([mmk(1n)], "KHR")).toThrow("Currency mismatch");
  });
});

import { describe, expect, it } from "vitest";
import { CURRENCY_CODES, CURRENCY_EXPONENT, isCurrencyCode } from "./currency";

describe("currency", () => {
  it("supports exactly MMK, USD and KHR", () => {
    expect(CURRENCY_CODES).toEqual(["MMK", "USD", "KHR"]);
  });

  it("uses 2 decimal places for every currency", () => {
    for (const code of CURRENCY_CODES) {
      expect(CURRENCY_EXPONENT[code]).toBe(2);
    }
  });

  it.each(["MMK", "USD", "KHR"])("isCurrencyCode accepts %s", (code) => {
    expect(isCurrencyCode(code)).toBe(true);
  });

  it.each([["usd"], ["EUR"], [""], [" MMK"], [1], [null], [undefined], [{}]])(
    "isCurrencyCode rejects %j",
    (value) => {
      expect(isCurrencyCode(value)).toBe(false);
    },
  );
});

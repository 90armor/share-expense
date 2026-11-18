import { describe, expect, it } from "vitest";
import type { CurrencyCode } from "@/lib/currency";
import { AMOUNT_MAX_MINOR_UNITS } from "@/lib/limits";
import { parseWith } from "@/lib/validation";
import { addSettlementGroupSchema, addSettlementSchema } from "./schema";

const GROUP = "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b";
const FROM = "8d1e2f3a-4b5c-4d6e-9f70-a1b2c3d4e5f6";
const TO = "b7c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e";

const valid = { groupId: GROUP, fromId: FROM, toId: TO, amount: "33.34" };

function parse(
  overrides: Record<string, unknown> = {},
  currency: CurrencyCode = "MMK",
) {
  return parseWith(addSettlementSchema(currency), {
    ...valid,
    ...overrides,
  });
}

function fieldErrors(overrides: Record<string, unknown>) {
  const result = parse(overrides);
  expect(result.ok).toBe(false);
  return result.ok ? {} : (result.error.fields ?? {});
}

describe("addSettlementGroupSchema", () => {
  it("accepts a UUID v4 groupId and drops other keys", () => {
    expect(parseWith(addSettlementGroupSchema, valid)).toEqual({
      ok: true,
      value: { groupId: GROUP },
    });
  });

  it.each([[""], ["not-an-id"], [undefined]])(
    "rejects groupId %j",
    (groupId) => {
      const result = parseWith(addSettlementGroupSchema, { groupId });
      expect(!result.ok && result.error.fields).toEqual({
        groupId: "Invalid ID",
      });
    },
  );
});

describe("addSettlementSchema", () => {
  it("parses a valid settlement: amount to minor units in the group currency", () => {
    expect(parse()).toEqual({
      ok: true,
      value: {
        groupId: GROUP,
        fromId: FROM,
        toId: TO,
        amount: { amount: 3334n, currency: "MMK" },
      },
    });
    const usd = parse({}, "USD");
    expect(usd.ok && usd.value.amount.currency).toBe("USD");
  });

  it("drops unknown keys", () => {
    const result = parse({ extra: "x", createdAt: "2020-01-01" });
    expect(result.ok && Object.keys(result.value).sort()).toEqual([
      "amount",
      "fromId",
      "groupId",
      "toId",
    ]);
  });

  describe("amount", () => {
    it.each([
      ["631192.00", 63119200n], // the plain decimal the form will send
      ["631,192.00", 63119200n],
      ["0.01", 1n],
      ["9,999,999,999.99", AMOUNT_MAX_MINOR_UNITS],
    ])("accepts %j", (amount, minor) => {
      const result = parse({ amount });
      expect(result.ok && result.value.amount.amount).toBe(minor);
    });

    it.each([
      ["", "Amount is required"],
      ["0", "Amount must be more than 0"],
      ["0.00", "Amount must be more than 0"],
      ["-5", "Amount cannot be negative"],
      ["1.234", "At most 2 decimal places"],
      ["abc", "Enter a valid amount, e.g. 1,234.50"],
      ["10,000,000,000.00", "Amount must be at most 9,999,999,999.99"],
    ])("rejects %j", (amount, message) => {
      expect(fieldErrors({ amount })).toEqual({ amount: message });
    });

    it("rejects a non-string amount", () => {
      expect(fieldErrors({ amount: 3334 })).toEqual({
        amount: "Amount must be text",
      });
    });
  });

  describe("members", () => {
    it("rejects a member paying themselves, on toId", () => {
      expect(fieldErrors({ toId: FROM })).toEqual({
        toId: "A member can't pay themselves",
      });
    });

    it.each([
      ["fromId", ""],
      ["fromId", "not-an-id"],
      ["fromId", undefined],
      ["toId", ""],
      ["toId", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"], // UUID v1
      ["toId", 42],
    ])("rejects %s %j as Invalid ID", (field, value) => {
      expect(fieldErrors({ [field]: value })).toEqual({
        [field]: "Invalid ID",
      });
    });
  });

  it("returns every field error at once", () => {
    expect(
      Object.keys(fieldErrors({ fromId: "", toId: "x", amount: "0" })).sort(),
    ).toEqual(["amount", "fromId", "toId"]);
  });
});

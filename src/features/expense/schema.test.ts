import { describe, expect, it } from "vitest";
import {
  AMOUNT_MAX_MINOR_UNITS,
  DESCRIPTION_MAX_LENGTH,
  PARTICIPANTS_MAX,
} from "@/lib/limits";
import { parseWith } from "@/lib/validation";
import { addExpenseGroupSchema, addExpenseSchema } from "./schema";

const GROUP = "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b";
const PAYER = "8d1e2f3a-4b5c-4d6e-9f70-a1b2c3d4e5f6";
const OTHER = "b7c8d9e0-f1a2-4b3c-8d4e-5f6a7b8c9d0e";

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
}

const valid = {
  groupId: GROUP,
  payerId: PAYER,
  amount: "1,234.50",
  description: "Dinner",
  participantIds: [PAYER, OTHER],
};

function parse(overrides: Record<string, unknown> = {}) {
  return parseWith(addExpenseSchema("MMK"), { ...valid, ...overrides });
}

function fieldErrors(overrides: Record<string, unknown>) {
  const result = parse(overrides);
  expect(result.ok).toBe(false);
  return result.ok ? {} : (result.error.fields ?? {});
}

describe("addExpenseGroupSchema", () => {
  it("accepts a UUID v4 groupId and drops other keys", () => {
    expect(parseWith(addExpenseGroupSchema, valid)).toEqual({
      ok: true,
      value: { groupId: GROUP },
    });
  });

  it.each([[""], ["not-an-id"], [undefined]])(
    "rejects groupId %j",
    (groupId) => {
      const result = parseWith(addExpenseGroupSchema, { groupId });
      expect(!result.ok && result.error.fields).toEqual({
        groupId: "Invalid ID",
      });
    },
  );
});

describe("addExpenseSchema", () => {
  it("parses a valid expense: amount to minor units in the group currency", () => {
    expect(parse()).toEqual({
      ok: true,
      value: {
        groupId: GROUP,
        payerId: PAYER,
        amount: { amount: 123450n, currency: "MMK" },
        description: "Dinner",
        participantIds: [PAYER, OTHER],
      },
    });
  });

  it("uses the currency it was built with", () => {
    const result = parseWith(addExpenseSchema("USD"), valid);
    expect(result.ok && result.value.amount.currency).toBe("USD");
  });

  it("allows a payer who is not a participant", () => {
    expect(parse({ participantIds: [OTHER] }).ok).toBe(true);
  });

  it("drops unknown keys", () => {
    const result = parse({ extra: "x" });
    expect(result.ok && "extra" in result.value).toBe(false);
  });

  describe("amount", () => {
    it.each([
      ["", "Amount is required"],
      ["0", "Amount must be more than 0"],
      ["0.00", "Amount must be more than 0"],
      ["-5", "Amount cannot be negative"],
      ["1.234", "At most 2 decimal places"],
      ["abc", "Enter a valid amount, e.g. 1,234.50"],
      ["10,000,000,000.00", "Amount must be at most 9,999,999,999.99"],
      ["92,233,720,368,547,758.07", "Amount must be at most 9,999,999,999.99"],
    ])("rejects %j", (amount, message) => {
      expect(fieldErrors({ amount })).toEqual({ amount: message });
    });

    it.each([
      ["0.01", 1n],
      ["9,999,999,999.99", AMOUNT_MAX_MINOR_UNITS],
      ["9999999999.99", AMOUNT_MAX_MINOR_UNITS],
    ])("accepts %j", (amount, minor) => {
      const result = parse({ amount });
      expect(result.ok && result.value.amount.amount).toBe(minor);
    });

    it("rejects a non-string amount", () => {
      expect(fieldErrors({ amount: 100 })).toEqual({
        amount: "Amount must be text",
      });
    });
  });

  describe("payerId", () => {
    it.each([[""], ["not-an-id"], [undefined]])("rejects %j", (payerId) => {
      expect(fieldErrors({ payerId })).toEqual({ payerId: "Choose who paid" });
    });
  });

  describe("participantIds", () => {
    it.each([
      [[], "Choose at least one person"],
      [undefined, "Choose at least one person"],
      ["not-an-array", "Choose at least one person"],
      [[PAYER, PAYER], "Each person can only be chosen once"],
      [[PAYER, "not-an-id"], "Invalid ID"],
      [[""], "Invalid ID"],
    ])("rejects %j", (participantIds, message) => {
      expect(fieldErrors({ participantIds })).toEqual({
        participantIds: message,
      });
    });

    it(`accepts ${PARTICIPANTS_MAX} distinct ids`, () => {
      const ids = Array.from({ length: PARTICIPANTS_MAX }, (_, i) => uuid(i));
      expect(parse({ participantIds: ids }).ok).toBe(true);
    });

    it(`rejects ${PARTICIPANTS_MAX + 1} ids`, () => {
      const ids = Array.from({ length: PARTICIPANTS_MAX + 1 }, (_, i) =>
        uuid(i),
      );
      expect(fieldErrors({ participantIds: ids })).toEqual({
        participantIds: `At most ${PARTICIPANTS_MAX} people per expense`,
      });
    });

    it("rejects a huge list with the size message", () => {
      const ids = Array.from({ length: 50_000 }, (_, i) => uuid(i));
      expect(fieldErrors({ participantIds: ids }).participantIds).toBe(
        `At most ${PARTICIPANTS_MAX} people per expense`,
      );
    });
  });

  describe("description", () => {
    it.each([[""], ["   "], [undefined]])("stores %j as null", (d) => {
      const result = parse({ description: d });
      expect(result.ok && result.value.description).toBeNull();
    });

    it("trims", () => {
      const result = parse({ description: "  Taxi  " });
      expect(result.ok && result.value.description).toBe("Taxi");
    });

    it("keeps Burmese text", () => {
      const result = parse({ description: "ညစာ" });
      expect(result.ok && result.value.description).toBe("ညစာ");
    });

    it(`accepts ${DESCRIPTION_MAX_LENGTH} characters and rejects one more`, () => {
      expect(
        parse({ description: "a".repeat(DESCRIPTION_MAX_LENGTH) }).ok,
      ).toBe(true);
      expect(
        fieldErrors({ description: "a".repeat(DESCRIPTION_MAX_LENGTH + 1) }),
      ).toEqual({
        description: `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
      });
    });

    it("rejects a non-string", () => {
      expect(fieldErrors({ description: 5 })).toEqual({
        description: "Description must be text",
      });
    });
  });

  it("reports every bad field at once", () => {
    expect(
      Object.keys(
        fieldErrors({ payerId: "", amount: "", participantIds: [] }),
      ).sort(),
    ).toEqual(["amount", "participantIds", "payerId"]);
  });
});

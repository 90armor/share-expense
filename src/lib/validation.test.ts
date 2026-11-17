import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  NAME_MAX_LENGTH,
  currencyCodeSchema,
  idSchema,
  moneyAmountSchema,
  nameSchema,
  parseWith,
} from "./validation";

describe("nameSchema", () => {
  it("trims and accepts a normal name", () => {
    expect(parseWith(nameSchema, "  Trip to Bagan  ")).toEqual({
      ok: true,
      value: "Trip to Bagan",
    });
  });

  it("accepts exactly the max length", () => {
    expect(parseWith(nameSchema, "a".repeat(NAME_MAX_LENGTH)).ok).toBe(true);
  });

  it.each([[""], ["   "], ["a".repeat(NAME_MAX_LENGTH + 1)], [123], [null]])(
    "rejects %j",
    (input) => {
      const result = parseWith(nameSchema, input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION");
        expect(result.error.fields?._root).toBeTruthy();
      }
    },
  );
});

const UUID_V4 = "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b";

describe("idSchema", () => {
  it("accepts a UUID v4 unchanged", () => {
    expect(parseWith(idSchema, UUID_V4)).toEqual({ ok: true, value: UUID_V4 });
  });

  it.each([
    [""],
    ["abc123"],
    [` ${UUID_V4}`],
    [`${UUID_V4} `],
    ["6ba7b810-9dad-11d1-80b4-00c04fd430c8"], // v1 (time-based)
    ["01890a5d-ac96-774b-bcce-b302099a8057"], // v7 (time-ordered)
    ["00000000-0000-0000-0000-000000000000"], // nil
    [42],
  ])("rejects %j", (input) => {
    const result = parseWith(idSchema, input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields?._root).toBe("Invalid ID");
    }
  });
});

describe("currencyCodeSchema", () => {
  it("accepts supported codes", () => {
    expect(parseWith(currencyCodeSchema, "KHR")).toEqual({
      ok: true,
      value: "KHR",
    });
  });

  it.each([["usd"], ["EUR"], [""], [1]])("rejects %j", (input) => {
    expect(parseWith(currencyCodeSchema, input).ok).toBe(false);
  });
});

describe("moneyAmountSchema", () => {
  it("transforms a valid string into Money (bigint minor units)", () => {
    expect(parseWith(moneyAmountSchema("MMK"), "1,234.5")).toEqual({
      ok: true,
      value: { amount: 123450n, currency: "MMK" },
    });
  });

  it("accepts zero", () => {
    expect(parseWith(moneyAmountSchema("USD"), "0")).toEqual({
      ok: true,
      value: { amount: 0n, currency: "USD" },
    });
  });

  it.each([["-1"], ["1.234"], ["1e3"], ["abc"], [""], ["007"], [12]])(
    "rejects %j",
    (input) => {
      const result = parseWith(moneyAmountSchema("USD"), input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.fields?._root).toBeTruthy();
      }
    },
  );
});

describe("parseWith field map", () => {
  const schema = z.object({
    name: nameSchema,
    currency: currencyCodeSchema,
    payer: z.object({ id: idSchema }),
    amount: moneyAmountSchema("MMK"),
  });

  it("returns the parsed value on success", () => {
    const result = parseWith(schema, {
      name: " Dinner ",
      currency: "MMK",
      payer: { id: UUID_V4 },
      amount: "15,000",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Dinner",
        currency: "MMK",
        payer: { id: UUID_V4 },
        amount: { amount: 1500000n, currency: "MMK" },
      },
    });
  });

  it("maps every invalid field to one message, using dotted paths", () => {
    const result = parseWith(schema, {
      name: "   ",
      currency: "EUR",
      payer: { id: "" },
      amount: "1.234",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(result.error.message).toBe("Invalid input");
    const fields = result.error.fields ?? {};
    expect(Object.keys(fields).sort()).toEqual([
      "amount",
      "currency",
      "name",
      "payer.id",
    ]);
    for (const message of Object.values(fields)) {
      expect(typeof message).toBe("string");
      expect(message).not.toBe("");
    }
    expect(fields.amount).toBe("At most 2 decimal places");
  });

  it("uses _root for a non-object input", () => {
    const result = parseWith(schema, "nope");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.error.fields ?? {})).toEqual(["_root"]);
    }
  });

  it("keeps errors for field names that exist on Object.prototype", () => {
    const protoSchema = z.object({
      constructor: nameSchema,
      toString: nameSchema,
    });
    const result = parseWith(protoSchema, { constructor: " ", toString: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields).toEqual({
      constructor: "Name is required",
      toString: "Name is required",
    });
  });
});

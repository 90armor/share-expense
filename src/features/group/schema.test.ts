import { describe, expect, it } from "vitest";
import { CURRENCY_CODES } from "@/lib/currency";
import { NAME_MAX_LENGTH, parseWith } from "@/lib/validation";
import { createGroupSchema } from "./schema";

describe("createGroupSchema", () => {
  it("accepts a valid group and trims the name", () => {
    expect(
      parseWith(createGroupSchema, { name: "  Trip  ", currency: "MMK" }),
    ).toEqual({ ok: true, value: { name: "Trip", currency: "MMK" } });
  });

  it.each(CURRENCY_CODES)("accepts currency %s", (currency) => {
    expect(parseWith(createGroupSchema, { name: "Trip", currency }).ok).toBe(
      true,
    );
  });

  it("accepts a Burmese name unchanged", () => {
    const name = "မန္တလေး ခရီးစဉ်";
    expect(parseWith(createGroupSchema, { name, currency: "MMK" })).toEqual({
      ok: true,
      value: { name, currency: "MMK" },
    });
  });

  it("accepts a name of exactly the max length", () => {
    const name = "a".repeat(NAME_MAX_LENGTH);
    expect(parseWith(createGroupSchema, { name, currency: "USD" }).ok).toBe(
      true,
    );
  });

  it.each([
    ["blank", ""],
    ["whitespace-only", "   "],
    ["too long", "a".repeat(NAME_MAX_LENGTH + 1)],
  ])("rejects a %s name with an error on `name` only", (_, name) => {
    const result = parseWith(createGroupSchema, { name, currency: "MMK" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(Object.keys(result.error.fields ?? {})).toEqual(["name"]);
  });

  it.each([["EUR"], ["usd"], [""], [undefined], [1]])(
    "rejects currency %j with an error on `currency` only",
    (currency) => {
      const result = parseWith(createGroupSchema, { name: "Trip", currency });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.error.fields ?? {})).toEqual(["currency"]);
      expect(result.error.fields?.currency).toBe("Unsupported currency");
    },
  );

  it("rejects an empty object with errors on both fields", () => {
    const result = parseWith(createGroupSchema, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.error.fields ?? {}).sort()).toEqual([
      "currency",
      "name",
    ]);
  });
});

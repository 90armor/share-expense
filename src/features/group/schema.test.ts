import { afterEach, describe, expect, it, vi } from "vitest";
import { CURRENCY_CODES } from "@/lib/currency";
import {
  GROUP_NAME_MAX_LENGTH as MAX,
  NAME_MAX_CODE_UNITS_PER_CHAR,
} from "@/lib/limits";
import { parseWith } from "@/lib/validation";
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

  describe("name length (visible characters, max 60)", () => {
    const TOO_LONG = `Name must be at most ${MAX} characters`;
    const parse = (name: string) =>
      parseWith(createGroupSchema, { name, currency: "USD" });
    const nameError = (name: string) => {
      const result = parse(name);
      return result.ok ? undefined : result.error.fields?.name;
    };

    afterEach(() => vi.restoreAllMocks());

    it("the limit is 60 and the message shows it", () => {
      // The one literal number: a wrong constant cannot pass silently.
      expect(nameError("a".repeat(MAX + 1))).toBe(
        "Name must be at most 60 characters",
      );
    });

    it("accepts exactly the max and rejects one more", () => {
      expect(parse("a".repeat(MAX)).ok).toBe(true);
      expect(nameError("a".repeat(MAX + 1))).toBe(TOO_LONG);
    });

    it("counts Burmese by visible character, not code unit", () => {
      // "ကို" is 3 code units but 1 visible character (grapheme).
      const name = "ကို".repeat(MAX);
      expect(name.length).toBeGreaterThan(MAX);
      expect(parse(name).ok).toBe(true);
      expect(nameError("ကို".repeat(MAX + 1))).toBe(TOO_LONG);
    });

    it("rejects one huge grapheme over the code-unit backstop, without segmenting it", () => {
      const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
      // 1 grapheme: "a" plus combining acute accents.
      const junk = "a" + "\u0301".repeat(MAX * NAME_MAX_CODE_UNITS_PER_CHAR);
      const result = createGroupSchema.safeParse({
        name: junk,
        currency: "USD",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toEqual([
        TOO_LONG,
      ]);
      expect(segment).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["blank", ""],
    ["whitespace-only", "   "],
    ["too long", "a".repeat(MAX + 1)],
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

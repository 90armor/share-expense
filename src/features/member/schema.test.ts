import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MEMBER_NAME_MAX_LENGTH as MAX,
  NAME_MAX_CODE_UNITS_PER_CHAR,
} from "@/lib/limits";
import { parseWith } from "@/lib/validation";
import { addMemberSchema, memberNameKey, removeMemberSchema } from "./schema";

const GROUP_ID = "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b";
const MEMBER_ID = "8d1e2f3a-4b5c-4d6e-9f70-a1b2c3d4e5f6";
/** UUID v7 (time-ordered): valid UUID, but not v4. */
const V7_ID = "01890a5d-ac96-774b-bcce-b302099a8057";

describe("addMemberSchema", () => {
  it("accepts a valid member and trims the name", () => {
    expect(
      parseWith(addMemberSchema, { groupId: GROUP_ID, name: "  Aung  " }),
    ).toEqual({ ok: true, value: { groupId: GROUP_ID, name: "Aung" } });
  });

  it("accepts a Burmese name unchanged", () => {
    const name = "အောင်အောင်";
    expect(parseWith(addMemberSchema, { groupId: GROUP_ID, name })).toEqual({
      ok: true,
      value: { groupId: GROUP_ID, name },
    });
  });

  describe("name length (visible characters, max 40)", () => {
    const TOO_LONG = `Name must be at most ${MAX} characters`;
    const parse = (name: string) =>
      parseWith(addMemberSchema, { groupId: GROUP_ID, name });
    const nameError = (name: string) => {
      const result = parse(name);
      return result.ok ? undefined : result.error.fields?.name;
    };

    afterEach(() => vi.restoreAllMocks());

    it("the limit is 40 and the message shows it", () => {
      // The one literal number: a wrong constant cannot pass silently.
      expect(nameError("a".repeat(MAX + 1))).toBe(
        "Name must be at most 40 characters",
      );
    });

    it("accepts exactly the max and rejects one more", () => {
      expect(parse("a".repeat(MAX)).ok).toBe(true);
      expect(nameError("a".repeat(MAX + 1))).toBe(TOO_LONG);
    });

    it("counts trimmed text only", () => {
      expect(parse(`  ${"a".repeat(MAX)}  `).ok).toBe(true);
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
      const result = addMemberSchema.safeParse({
        groupId: GROUP_ID,
        name: junk,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toEqual([
        TOO_LONG,
      ]);
      expect(segment).not.toHaveBeenCalled();
    });
  });

  it("drops a client-sent nameKey (the service computes it)", () => {
    const result = parseWith(addMemberSchema, {
      groupId: GROUP_ID,
      name: "Aung",
      nameKey: "someone-else",
    });
    expect(result).toEqual({
      ok: true,
      value: { groupId: GROUP_ID, name: "Aung" },
    });
  });

  it.each([
    ["blank", ""],
    ["whitespace-only", "   "],
    ["too long", "a".repeat(MAX + 1)],
  ])("rejects a %s name with an error on `name` only", (_, name) => {
    const result = parseWith(addMemberSchema, { groupId: GROUP_ID, name });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(Object.keys(result.error.fields ?? {})).toEqual(["name"]);
  });

  it.each([["not-an-id"], [""], [V7_ID], [` ${GROUP_ID}`], [undefined], [1]])(
    "rejects groupId %j with an error on `groupId` only",
    (groupId) => {
      const result = parseWith(addMemberSchema, { groupId, name: "Aung" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.error.fields ?? {})).toEqual(["groupId"]);
    },
  );
});

describe("removeMemberSchema", () => {
  it("accepts two UUID v4 ids", () => {
    expect(
      parseWith(removeMemberSchema, { groupId: GROUP_ID, memberId: MEMBER_ID }),
    ).toEqual({ ok: true, value: { groupId: GROUP_ID, memberId: MEMBER_ID } });
  });

  it.each([["not-an-id"], [""], [V7_ID], [undefined]])(
    "rejects memberId %j",
    (memberId) => {
      const result = parseWith(removeMemberSchema, {
        groupId: GROUP_ID,
        memberId,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(Object.keys(result.error.fields ?? {})).toEqual(["memberId"]);
    },
  );

  it("rejects an empty object with errors on both ids", () => {
    const result = parseWith(removeMemberSchema, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.error.fields ?? {}).sort()).toEqual([
      "groupId",
      "memberId",
    ]);
  });
});

describe("memberNameKey", () => {
  it.each([
    ["Aung", "aung"],
    ["AUNG", "aung"],
    ["  Aung  ", "aung"],
    ["Aung   Aung", "aung aung"],
    ["Aung\tAung", "aung aung"],
  ])("maps %j to %j", (name, key) => {
    expect(memberNameKey(name)).toBe(key);
  });

  it("gives case and spacing variants the same key", () => {
    const keys = new Set(
      ["Aung Aung", "aung aung", "AUNG   AUNG", " Aung Aung "].map(
        memberNameKey,
      ),
    );
    expect(keys.size).toBe(1);
  });

  it("applies NFC, so composed and decomposed forms match", () => {
    expect(memberNameKey("René")).toBe(memberNameKey("René"));
    expect(memberNameKey("René")).toBe("rené");
  });

  it("leaves a Burmese name unchanged", () => {
    const name = "အောင်အောင်";
    expect(memberNameKey(name)).toBe(name);
  });

  it("does not strip a zero-width space (known limitation)", () => {
    expect(memberNameKey("Aung​Aung")).not.toBe(memberNameKey("AungAung"));
  });
});

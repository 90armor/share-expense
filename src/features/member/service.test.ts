import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { MEMBER_NAME_MAX_LENGTH } from "@/lib/limits";
import { idSchema, parseWith } from "@/lib/validation";
import { createTestDb, type TestDb } from "@/server/testDb";
import { addMember, listMembers, removeMember } from "./service";

/** Valid-looking UUID v4s that are never inserted. */
const MISSING_ID = "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b";
const MISSING_ID_2 = "8d1e2f3a-4b5c-4d6e-9f70-a1b2c3d4e5f6";
const UNEXPECTED_MESSAGE = "Something went wrong. Please try again.";

describe("member service (temp SQLite with migrations applied)", () => {
  let testDb: TestDb;
  let groupA: string;
  let groupB: string;

  beforeEach(async () => {
    testDb = createTestDb();
    groupA = (
      await testDb.db.group.create({ data: { name: "A", currency: "MMK" } })
    ).id;
    groupB = (
      await testDb.db.group.create({ data: { name: "B", currency: "USD" } })
    ).id;
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  async function add(groupId: string, name: string) {
    const result = await addMember(testDb.db, { groupId, name });
    if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
    return result.value;
  }

  describe("addMember", () => {
    it("adds a member that listMembers reads back", async () => {
      const added = await addMember(testDb.db, {
        groupId: groupA,
        name: "Aung",
      });

      expect(added).toEqual({
        ok: true,
        value: { id: expect.any(String), name: "Aung" },
      });
      if (!added.ok) return;
      expect(parseWith(idSchema, added.value.id).ok).toBe(true);
      expect(await listMembers(testDb.db, groupA)).toEqual({
        ok: true,
        value: [added.value],
      });
    });

    it("stores the trimmed name and a service-computed key", async () => {
      await add(groupA, "  Aung   Aung  ");

      const rows = await testDb.db.member.findMany();
      expect(rows.map((row) => [row.name, row.nameKey])).toEqual([
        ["Aung   Aung", "aung aung"],
      ]);
    });

    it("ignores a nameKey sent by the caller", async () => {
      await addMember(testDb.db, {
        groupId: groupA,
        name: "Aung",
        nameKey: "someone-else",
      });

      const rows = await testDb.db.member.findMany();
      expect(rows.map((row) => row.nameKey)).toEqual(["aung"]);
    });

    it.each([
      ["Aung", "aung"],
      ["Aung", "AUNG"],
      ["Aung", "Aung "],
      ["Aung Aung", "Aung   Aung"],
      ["Aung Aung", "aung\taung"],
    ])(
      "rejects %j then %j in one group with CONFLICT",
      async (first, second) => {
        await add(groupA, first);

        const result = await addMember(testDb.db, {
          groupId: groupA,
          name: second,
        });

        expect(result).toEqual({
          ok: false,
          error: {
            code: "CONFLICT",
            message: expect.stringContaining("already in this group"),
          },
        });
        expect(await testDb.db.member.count()).toBe(1);
      },
    );

    it.each([
      ["Aung", "aung"],
      ["Aung Aung", "Aung   Aung"],
    ])("allows %j and %j in two different groups", async (first, second) => {
      await add(groupA, first);
      await add(groupB, second);

      expect(await testDb.db.member.count()).toBe(2);
    });

    it("round-trips a Burmese name unchanged", async () => {
      const name = "အောင်အောင်";
      const added = await add(groupA, name);

      const list = await listMembers(testDb.db, groupA);
      expect(list.ok && list.value.map((member) => member.name)).toEqual([
        name,
      ]);
      const row = await testDb.db.member.findUnique({
        where: { id: added.id },
      });
      expect(Buffer.from(row!.name)).toEqual(Buffer.from(name));
    });

    it("rejects the same Burmese name twice in one group with CONFLICT", async () => {
      await add(groupA, "အောင်အောင်");

      const result = await addMember(testDb.db, {
        groupId: groupA,
        name: "အောင်အောင်",
      });

      expect(!result.ok && result.error.code).toBe("CONFLICT");
      expect(await testDb.db.member.count()).toBe(1);
    });

    it("lets exactly one of two concurrent adds of one name win", async () => {
      const results = await Promise.all([
        addMember(testDb.db, { groupId: groupA, name: "Aung" }),
        addMember(testDb.db, { groupId: groupA, name: "aung" }),
      ]);

      const codes = results
        .map((result) => (result.ok ? "ok" : result.error.code))
        .sort();
      expect(codes).toEqual(["CONFLICT", "ok"]);
      expect(await testDb.db.member.count()).toBe(1);
    });

    it.each([
      ["blank name", { name: "" }, ["name"]],
      ["whitespace-only name", { name: "   " }, ["name"]],
      [
        "too-long name",
        { name: "a".repeat(MEMBER_NAME_MAX_LENGTH + 1) },
        ["name"],
      ],
      ["missing name", {}, ["name"]],
    ])("rejects a %s and inserts nothing", async (_, input, fields) => {
      const result = await addMember(testDb.db, { groupId: groupA, ...input });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("VALIDATION");
      expect(Object.keys(result.error.fields ?? {})).toEqual(fields);
      expect(await testDb.db.member.count()).toBe(0);
    });

    it.each([[null], ["nope"], [42], [{}]])(
      "rejects input %j and inserts nothing",
      async (input) => {
        const result = await addMember(testDb.db, input);
        expect(!result.ok && result.error.code).toBe("VALIDATION");
        expect(await testDb.db.member.count()).toBe(0);
      },
    );

    it.each([["not-an-id"], [""], [` ${MISSING_ID}`]])(
      "rejects malformed groupId %j with VALIDATION",
      async (groupId) => {
        const result = await addMember(testDb.db, { groupId, name: "Aung" });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("VALIDATION");
        expect(Object.keys(result.error.fields ?? {})).toEqual(["groupId"]);
      },
    );

    it("returns NOT_FOUND for a group that does not exist", async () => {
      const result = await addMember(testDb.db, {
        groupId: MISSING_ID,
        name: "Aung",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "Group not found" },
      });
      expect(await testDb.db.member.count()).toBe(0);
    });
  });

  describe("listMembers", () => {
    it("lists only this group's members, oldest first", async () => {
      const at = (second: number) =>
        new Date(Date.UTC(2026, 0, 1, 0, 0, second));
      for (const [groupId, name, second] of [
        [groupA, "Second", 2],
        [groupB, "Other group", 1],
        [groupA, "First", 1],
        [groupA, "Third", 3],
      ] as const) {
        await testDb.db.member.create({
          data: {
            groupId,
            name,
            nameKey: name.toLowerCase(),
            createdAt: at(second),
          },
        });
      }

      const result = await listMembers(testDb.db, groupA);
      expect(result.ok && result.value.map((member) => member.name)).toEqual([
        "First",
        "Second",
        "Third",
      ]);
    });

    it("returns shaped members only (no groupId, nameKey or createdAt)", async () => {
      await add(groupA, "Aung");

      const result = await listMembers(testDb.db, groupA);
      expect(result.ok && Object.keys(result.value[0]).sort()).toEqual([
        "id",
        "name",
      ]);
    });

    it("returns an empty list for a group with no members", async () => {
      expect(await listMembers(testDb.db, groupA)).toEqual({
        ok: true,
        value: [],
      });
    });

    it.each([["not-an-id"], [""], [42], [undefined]])(
      "returns VALIDATION for malformed id %j",
      async (id) => {
        const result = await listMembers(testDb.db, id);
        expect(!result.ok && result.error.code).toBe("VALIDATION");
      },
    );
  });

  describe("removeMember", () => {
    it("removes a member of the group", async () => {
      const aung = await add(groupA, "Aung");
      const mya = await add(groupA, "Mya");

      expect(
        await removeMember(testDb.db, { groupId: groupA, memberId: aung.id }),
      ).toEqual({ ok: true, value: { id: aung.id } });
      expect(await listMembers(testDb.db, groupA)).toEqual({
        ok: true,
        value: [mya],
      });
    });

    it("returns NOT_FOUND when the member is removed twice", async () => {
      const aung = await add(groupA, "Aung");
      await removeMember(testDb.db, { groupId: groupA, memberId: aung.id });

      const again = await removeMember(testDb.db, {
        groupId: groupA,
        memberId: aung.id,
      });
      expect(again).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "Member not found" },
      });
    });

    it("returns NOT_FOUND for a member of another group and keeps it", async () => {
      const inB = await add(groupB, "Aung");

      const result = await removeMember(testDb.db, {
        groupId: groupA,
        memberId: inB.id,
      });

      expect(!result.ok && result.error.code).toBe("NOT_FOUND");
      expect(await listMembers(testDb.db, groupB)).toEqual({
        ok: true,
        value: [inB],
      });
    });

    it.each([
      [
        "a missing member id",
        () => ({ groupId: groupA, memberId: MISSING_ID }),
      ],
      [
        "a missing group id",
        () => ({ groupId: MISSING_ID, memberId: MISSING_ID_2 }),
      ],
    ])("returns NOT_FOUND for %s", async (_, input) => {
      await add(groupA, "Aung");

      const result = await removeMember(testDb.db, input());

      expect(!result.ok && result.error.code).toBe("NOT_FOUND");
      expect(await testDb.db.member.count()).toBe(1);
    });

    // A member who paid for or shares an expense is kept (FK Restrict -> CONFLICT).
    describe("with expenses", () => {
      const CONFLICT = {
        ok: false,
        error: {
          code: "CONFLICT",
          message:
            "This member paid for or shares an expense and can't be removed.",
        },
      };

      async function expense(payerId: string, participantIds: string[]) {
        await testDb.db.expense.create({
          data: {
            groupId: groupA,
            payerId,
            amount: 1000n,
            participants: {
              create: participantIds.map((memberId) => ({ memberId })),
            },
          },
        });
      }

      it("returns CONFLICT for the payer and keeps the member", async () => {
        const aung = await add(groupA, "Aung");
        const mya = await add(groupA, "Mya");
        await expense(aung.id, [mya.id]);

        expect(
          await removeMember(testDb.db, { groupId: groupA, memberId: aung.id }),
        ).toEqual(CONFLICT);
        expect(await testDb.db.member.count({ where: { id: aung.id } })).toBe(
          1,
        );
      });

      it("returns CONFLICT for a participant who did not pay", async () => {
        const aung = await add(groupA, "Aung");
        const mya = await add(groupA, "Mya");
        await expense(aung.id, [aung.id, mya.id]);

        expect(
          await removeMember(testDb.db, { groupId: groupA, memberId: mya.id }),
        ).toEqual(CONFLICT);
        expect(await testDb.db.member.count({ where: { id: mya.id } })).toBe(1);
        expect(await testDb.db.expenseParticipant.count()).toBe(2);
      });

      it("still removes a member with no expenses in the same group", async () => {
        const aung = await add(groupA, "Aung");
        const kyaw = await add(groupA, "Kyaw");
        await expense(aung.id, [aung.id]);

        expect(
          await removeMember(testDb.db, { groupId: groupA, memberId: kyaw.id }),
        ).toEqual({ ok: true, value: { id: kyaw.id } });
      });

      it("returns NOT_FOUND (not CONFLICT) for such a member via another group", async () => {
        const aung = await add(groupA, "Aung");
        await expense(aung.id, [aung.id]);

        const result = await removeMember(testDb.db, {
          groupId: groupB,
          memberId: aung.id,
        });
        expect(!result.ok && result.error.code).toBe("NOT_FOUND");
      });
    });

    // Settlement -> Member FKs are Restrict too. These members have no
    // expenses, so only the settlement FK can refuse the delete. The message
    // is the existing one (SQLite does not say which FK refused).
    describe("with settlements", () => {
      const CONFLICT = {
        ok: false,
        error: {
          code: "CONFLICT",
          message:
            "This member paid for or shares an expense and can't be removed.",
        },
      };

      async function settlement(fromId: string, toId: string) {
        await testDb.db.settlement.create({
          data: { groupId: groupA, fromId, toId, amount: 1000n },
        });
      }

      it("returns CONFLICT for the payer of a settlement and keeps the member", async () => {
        const aung = await add(groupA, "Aung");
        const mya = await add(groupA, "Mya");
        await settlement(mya.id, aung.id);
        expect(await testDb.db.expense.count()).toBe(0);

        expect(
          await removeMember(testDb.db, { groupId: groupA, memberId: mya.id }),
        ).toEqual(CONFLICT);
        expect(await testDb.db.member.count({ where: { id: mya.id } })).toBe(1);
        expect(await testDb.db.settlement.count()).toBe(1);
      });

      it("returns CONFLICT for the receiver of a settlement and keeps the member", async () => {
        const aung = await add(groupA, "Aung");
        const mya = await add(groupA, "Mya");
        await settlement(mya.id, aung.id);

        expect(
          await removeMember(testDb.db, { groupId: groupA, memberId: aung.id }),
        ).toEqual(CONFLICT);
        expect(await testDb.db.member.count({ where: { id: aung.id } })).toBe(
          1,
        );
        expect(await testDb.db.settlement.count()).toBe(1);
      });

      it("still removes a member who is in no settlement", async () => {
        const aung = await add(groupA, "Aung");
        const mya = await add(groupA, "Mya");
        const kyaw = await add(groupA, "Kyaw");
        await settlement(mya.id, aung.id);

        expect(
          await removeMember(testDb.db, { groupId: groupA, memberId: kyaw.id }),
        ).toEqual({ ok: true, value: { id: kyaw.id } });
        expect(await testDb.db.member.count()).toBe(2);
      });
    });

    it.each([
      [{ groupId: "not-an-id", memberId: MISSING_ID }, ["groupId"]],
      [{ groupId: MISSING_ID, memberId: "" }, ["memberId"]],
      [{}, ["groupId", "memberId"]],
    ])("returns VALIDATION for %j", async (input, fields) => {
      const result = await removeMember(testDb.db, input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("VALIDATION");
      expect(Object.keys(result.error.fields ?? {}).sort()).toEqual(fields);
    });
  });

  // Foreign keys are enforced, so the Restrict relations from Expense and
  // ExpenseParticipant to Member actually block deletes (see removeMember CONFLICT).
  describe("database foreign keys", () => {
    it("are switched on for the createTestDb client", async () => {
      const rows = await testDb.db.$queryRawUnsafe<
        Array<{ foreign_keys: bigint | number }>
      >("PRAGMA foreign_keys");
      expect(Number(rows[0].foreign_keys)).toBe(1);
    });

    it("refuse to delete a group that still has members", async () => {
      const aung = await add(groupA, "Aung");

      await expect(
        testDb.db.group.delete({ where: { id: groupA } }),
      ).rejects.toMatchObject({ code: "P2003" });
      expect(await testDb.db.group.count()).toBe(2);
      expect(
        await testDb.db.member.findUnique({ where: { id: aung.id } }),
      ).not.toBeNull();
    });
  });
});

describe("member service (database failure)", () => {
  const boom = () => Promise.reject(new Error("boom: disk I/O error"));
  const failingDb = {
    group: { findUnique: boom },
    member: { create: boom, findMany: boom, deleteMany: boom },
  } as unknown as PrismaClient;

  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it.each([
    [
      "addMember",
      () => addMember(failingDb, { groupId: MISSING_ID, name: "A" }),
    ],
    ["listMembers", () => listMembers(failingDb, MISSING_ID)],
    [
      "removeMember",
      () =>
        removeMember(failingDb, {
          groupId: MISSING_ID,
          memberId: MISSING_ID_2,
        }),
    ],
  ])(
    "%s returns a generic UNEXPECTED error and logs the details",
    async (_, call) => {
      const result = await call();

      expect(result).toEqual({
        ok: false,
        error: { code: "UNEXPECTED", message: UNEXPECTED_MESSAGE },
      });
      expect(JSON.stringify(result)).not.toContain("boom");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[member]"),
        expect.any(Error),
      );
    },
  );

  it("treats a foreign-key error from another model as UNEXPECTED, not CONFLICT", async () => {
    const otherForeignKey = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint violated",
      {
        code: "P2003",
        clientVersion: "7.10.1",
        meta: {
          modelName: "Group",
          driverAdapterError: {
            cause: { kind: "ForeignKeyConstraintViolation" },
          },
        },
      },
    );
    const db = {
      member: { deleteMany: () => Promise.reject(otherForeignKey) },
    } as unknown as PrismaClient;

    const result = await removeMember(db, {
      groupId: MISSING_ID,
      memberId: MISSING_ID_2,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "UNEXPECTED", message: UNEXPECTED_MESSAGE },
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("treats a unique error from any other index as UNEXPECTED, not CONFLICT", async () => {
    const otherUnique = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "7.10.1",
        meta: {
          modelName: "Member",
          driverAdapterError: { cause: { constraint: { fields: ["id"] } } },
        },
      },
    );
    const db = {
      group: { findUnique: () => Promise.resolve({ id: MISSING_ID }) },
      member: { create: () => Promise.reject(otherUnique) },
    } as unknown as PrismaClient;

    const result = await addMember(db, { groupId: MISSING_ID, name: "Aung" });

    expect(result).toEqual({
      ok: false,
      error: { code: "UNEXPECTED", message: UNEXPECTED_MESSAGE },
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});

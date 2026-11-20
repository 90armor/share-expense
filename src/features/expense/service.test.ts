import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { AMOUNT_MAX_MINOR_UNITS } from "@/lib/limits";
import { createTestDb, type TestDb } from "@/server/testDb";
import { addExpense, listExpenses } from "./service";

/** Valid-looking UUID v4s that are never inserted. */
const MISSING_ID = "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b";
const MISSING_ID_2 = "8d1e2f3a-4b5c-4d6e-9f70-a1b2c3d4e5f6";
const UNEXPECTED_MESSAGE = "Something went wrong. Please try again.";

describe("expense service (temp SQLite with migrations applied)", () => {
  let testDb: TestDb;
  let groupA: string;
  let groupB: string;
  let aung: { id: string; name: string };
  let mya: { id: string; name: string };
  let kyaw: { id: string; name: string };
  let inB: { id: string; name: string };
  let errorSpy: ReturnType<typeof vi.spyOn>;

  // Members created in one test can share a millisecond; ties then fall back
  // to the random id. Give each one a later createdAt so "member order" is
  // the creation order these tests rely on.
  let memberClock = Date.UTC(2026, 0, 1);
  async function member(groupId: string, name: string) {
    memberClock += 1000;
    return testDb.db.member.create({
      data: {
        groupId,
        name,
        nameKey: name.toLowerCase(),
        createdAt: new Date(memberClock),
      },
      select: { id: true, name: true },
    });
  }

  async function counts() {
    return {
      expenses: await testDb.db.expense.count(),
      participants: await testDb.db.expenseParticipant.count(),
    };
  }

  beforeEach(async () => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    testDb = createTestDb();
    groupA = (
      await testDb.db.group.create({ data: { name: "A", currency: "MMK" } })
    ).id;
    groupB = (
      await testDb.db.group.create({ data: { name: "B", currency: "USD" } })
    ).id;
    aung = await member(groupA, "Aung");
    mya = await member(groupA, "Mya");
    kyaw = await member(groupA, "Kyaw");
    inB = await member(groupB, "Bo");
  });

  afterEach(async () => {
    errorSpy.mockRestore();
    await testDb.cleanup();
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      groupId: groupA,
      payerId: aung.id,
      amount: "1,234.50",
      description: "Dinner",
      participantIds: [aung.id, mya.id],
      ...overrides,
    };
  }

  describe("addExpense", () => {
    it("adds an expense that listExpenses reads back", async () => {
      const added = await addExpense(testDb.db, input());

      expect(added).toEqual({ ok: true, value: { id: expect.any(String) } });
      if (!added.ok) return;
      expect(await listExpenses(testDb.db, groupA)).toEqual({
        ok: true,
        value: [
          {
            id: added.value.id,
            description: "Dinner",
            amount: { amount: 123450n, currency: "MMK" },
            payer: aung,
            participants: [aung, mya],
          },
        ],
      });
    });

    it("stores the amount cap exactly as a bigint", async () => {
      await addExpense(testDb.db, input({ amount: "9,999,999,999.99" }));

      const row = await testDb.db.expense.findFirstOrThrow();
      expect(row.amount).toBe(AMOUNT_MAX_MINOR_UNITS);
    });

    it("accepts a payer who is not a participant", async () => {
      const added = await addExpense(
        testDb.db,
        input({ participantIds: [mya.id, kyaw.id] }),
      );
      expect(added.ok).toBe(true);

      const list = await listExpenses(testDb.db, groupA);
      expect(list.ok && list.value[0].payer).toEqual(aung);
      expect(list.ok && list.value[0].participants).toEqual([mya, kyaw]);
    });

    it("stores a blank description as null and Burmese text as typed", async () => {
      await addExpense(testDb.db, input({ description: "   " }));
      await addExpense(testDb.db, input({ description: " ညစာ " }));

      const rows = await testDb.db.expense.findMany({
        orderBy: { createdAt: "asc" },
      });
      expect(rows.map((row) => row.description).sort()).toEqual(
        [null, "ညစာ"].sort(),
      );
    });

    it("uses the group's currency", async () => {
      const bob = await member(groupB, "Bob");
      await addExpense(testDb.db, {
        groupId: groupB,
        payerId: inB.id,
        amount: "10",
        participantIds: [inB.id, bob.id],
      });

      const list = await listExpenses(testDb.db, groupB);
      expect(list.ok && list.value[0].amount).toEqual({
        amount: 1000n,
        currency: "USD",
      });
    });

    // Security: ids come from the form and are untrusted.
    it("rejects a payer from another group and inserts nothing", async () => {
      const result = await addExpense(testDb.db, input({ payerId: inB.id }));

      expect(result).toEqual({
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Invalid input",
          fields: { payerId: "Choose a member of this group" },
        },
      });
      expect(await counts()).toEqual({ expenses: 0, participants: 0 });
    });

    it("rejects a participant from another group and inserts nothing", async () => {
      const result = await addExpense(
        testDb.db,
        input({ participantIds: [aung.id, inB.id] }),
      );

      expect(result).toEqual({
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Invalid input",
          fields: { participantIds: "Choose only members of this group" },
        },
      });
      expect(await counts()).toEqual({ expenses: 0, participants: 0 });
    });

    it("rejects ids that are not members anywhere", async () => {
      const result = await addExpense(
        testDb.db,
        input({ payerId: MISSING_ID, participantIds: [MISSING_ID_2] }),
      );

      // Full result, not only the fields: must match the other-group cases
      // above exactly (no existence leak).
      expect(result).toEqual({
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Invalid input",
          fields: {
            payerId: "Choose a member of this group",
            participantIds: "Choose only members of this group",
          },
        },
      });
      expect(await counts()).toEqual({ expenses: 0, participants: 0 });
    });

    it("rejects a group with no members", async () => {
      const empty = (
        await testDb.db.group.create({ data: { name: "E", currency: "MMK" } })
      ).id;

      const result = await addExpense(testDb.db, input({ groupId: empty }));

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe("VALIDATION");
      expect(await counts()).toEqual({ expenses: 0, participants: 0 });
    });

    it("returns NOT_FOUND for an unknown group", async () => {
      expect(
        await addExpense(testDb.db, input({ groupId: MISSING_ID })),
      ).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "Group not found" },
      });
    });

    it("returns VALIDATION for a malformed group id", async () => {
      const result = await addExpense(testDb.db, input({ groupId: "nope" }));
      expect(!result.ok && result.error.fields).toEqual({
        groupId: "Invalid ID",
      });
    });

    it("returns every field error at once and inserts nothing", async () => {
      const result = await addExpense(
        testDb.db,
        input({ payerId: "", amount: "0", participantIds: [] }),
      );

      expect(
        !result.ok && Object.keys(result.error.fields ?? {}).sort(),
      ).toEqual(["amount", "participantIds", "payerId"]);
      expect(await counts()).toEqual({ expenses: 0, participants: 0 });
    });

    // All or nothing: the expense row is written, then the participant insert
    // fails; the interactive transaction must roll the expense back.
    it("rolls back the expense when the participant insert fails", async () => {
      const createdIds: string[] = [];
      const failing = testDb.db.$extends({
        query: {
          expense: {
            async create({ args, query }) {
              const row = await query(args);
              createdIds.push((row as { id: string }).id);
              return row;
            },
          },
          expenseParticipant: {
            createMany() {
              throw new Error("boom: participant insert failed");
            },
          },
        },
      }) as unknown as PrismaClient;

      const result = await addExpense(failing, input());

      expect(result).toEqual({
        ok: false,
        error: { code: "UNEXPECTED", message: UNEXPECTED_MESSAGE },
      });
      expect(createdIds).toHaveLength(1);
      expect(await counts()).toEqual({ expenses: 0, participants: 0 });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[expense]"),
        expect.any(Error),
      );
    });
  });

  describe("listExpenses", () => {
    it("lists newest first and only this group's expenses", async () => {
      const first = await addExpense(testDb.db, input({ description: "1st" }));
      const second = await addExpense(testDb.db, input({ description: "2nd" }));
      await addExpense(testDb.db, {
        groupId: groupB,
        payerId: inB.id,
        amount: "5",
        participantIds: [inB.id],
      });
      if (!first.ok || !second.ok) throw new Error("setup failed");
      // Same-millisecond inserts would tie; set the times explicitly.
      await testDb.db.expense.update({
        where: { id: first.value.id },
        data: { createdAt: new Date("2026-01-01T00:00:00Z") },
      });
      await testDb.db.expense.update({
        where: { id: second.value.id },
        data: { createdAt: new Date("2026-01-02T00:00:00Z") },
      });

      const list = await listExpenses(testDb.db, groupA);
      expect(list.ok && list.value.map((e) => e.description)).toEqual([
        "2nd",
        "1st",
      ]);
    });

    it("lists participants in member order", async () => {
      await addExpense(
        testDb.db,
        input({ participantIds: [kyaw.id, aung.id, mya.id] }),
      );

      const list = await listExpenses(testDb.db, groupA);
      expect(list.ok && list.value[0].participants).toEqual([aung, mya, kyaw]);
    });

    it("returns an empty list for a group with no expenses", async () => {
      expect(await listExpenses(testDb.db, groupA)).toEqual({
        ok: true,
        value: [],
      });
    });

    it("returns VALIDATION for a malformed id", async () => {
      const result = await listExpenses(testDb.db, "nope");
      expect(!result.ok && result.error.code).toBe("VALIDATION");
    });

    it("returns UNEXPECTED when the stored currency is not supported", async () => {
      await addExpense(testDb.db, input());
      await testDb.db.group.update({
        where: { id: groupA },
        data: { currency: "XXX" },
      });

      expect(await listExpenses(testDb.db, groupA)).toEqual({
        ok: false,
        error: { code: "UNEXPECTED", message: UNEXPECTED_MESSAGE },
      });
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});

describe("expense service (database failure)", () => {
  const boom = () => Promise.reject(new Error("boom: disk I/O error"));
  const failingDb = {
    $transaction: boom,
    expense: { findMany: boom },
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
      "addExpense",
      () =>
        addExpense(failingDb, {
          groupId: MISSING_ID,
          payerId: MISSING_ID_2,
          amount: "1",
          participantIds: [MISSING_ID_2],
        }),
    ],
    ["listExpenses", () => listExpenses(failingDb, MISSING_ID)],
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
        expect.stringContaining("[expense]"),
        expect.any(Error),
      );
    },
  );
});

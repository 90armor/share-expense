import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { AMOUNT_MAX_MINOR_UNITS } from "@/lib/limits";
import { createTestDb, type TestDb } from "@/server/testDb";
import { addSettlement, listSettlements } from "./service";

/** Valid-looking UUID v4s that are never inserted. */
const MISSING_ID = "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b";
const MISSING_ID_2 = "8d1e2f3a-4b5c-4d6e-9f70-a1b2c3d4e5f6";
const UNEXPECTED_MESSAGE = "Something went wrong. Please try again.";
const NOT_A_MEMBER = "Choose a member of this group";

describe("settlement service (temp SQLite with migrations applied)", () => {
  let testDb: TestDb;
  let groupA: string;
  let groupB: string;
  let aung: { id: string; name: string };
  let mya: { id: string; name: string };
  let inB: { id: string; name: string };
  let errorSpy: ReturnType<typeof vi.spyOn>;

  async function member(groupId: string, name: string) {
    return testDb.db.member.create({
      data: { groupId, name, nameKey: name.toLowerCase() },
      select: { id: true, name: true },
    });
  }

  const count = () => testDb.db.settlement.count();

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
    inB = await member(groupB, "Bo");
  });

  afterEach(async () => {
    errorSpy.mockRestore();
    await testDb.cleanup();
  });

  /** Mya pays Aung 631,192.00 MMK unless overridden. */
  function input(overrides: Record<string, unknown> = {}) {
    return {
      groupId: groupA,
      fromId: mya.id,
      toId: aung.id,
      amount: "631192.00",
      ...overrides,
    };
  }

  function validation(fields: Record<string, string>) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Invalid input", fields },
    };
  }

  describe("addSettlement", () => {
    it("adds a settlement that listSettlements reads back", async () => {
      const added = await addSettlement(testDb.db, input());

      expect(added).toEqual({ ok: true, value: { id: expect.any(String) } });
      if (!added.ok) return;
      expect(await listSettlements(testDb.db, groupA)).toEqual({
        ok: true,
        value: [
          {
            id: added.value.id,
            fromId: mya.id,
            toId: aung.id,
            amount: { amount: 63119200n, currency: "MMK" },
          },
        ],
      });
    });

    it("stores the amount as bigint minor units (grouped input too, and the cap)", async () => {
      await addSettlement(testDb.db, input({ amount: "631,192.00" }));
      await addSettlement(testDb.db, input({ amount: "9,999,999,999.99" }));

      const rows = await testDb.db.settlement.findMany({
        orderBy: { amount: "asc" },
      });
      expect(rows.map((row) => row.amount)).toEqual([
        63119200n,
        AMOUNT_MAX_MINOR_UNITS,
      ]);
      expect(rows.every((row) => row.groupId === groupA)).toBe(true);
    });

    it("gives the new row a UUID v4 id", async () => {
      const added = await addSettlement(testDb.db, input());
      expect(added.ok && added.value.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it("uses the group's currency", async () => {
      const bob = await member(groupB, "Bob");
      await addSettlement(testDb.db, {
        groupId: groupB,
        fromId: inB.id,
        toId: bob.id,
        amount: "10",
      });

      const list = await listSettlements(testDb.db, groupB);
      expect(list.ok && list.value.map((s) => s.amount)).toEqual([
        { amount: 1000n, currency: "USD" },
      ]);
    });

    it("rejects a member paying themselves and inserts nothing", async () => {
      expect(await addSettlement(testDb.db, input({ toId: mya.id }))).toEqual(
        validation({ toId: "A member can't pay themselves" }),
      );
      expect(await count()).toBe(0);
    });

    it.each([
      ["0", "Amount must be more than 0"],
      ["10,000,000,000.00", "Amount must be at most 9,999,999,999.99"],
      ["-1", "Amount cannot be negative"],
    ])("rejects amount %j and inserts nothing", async (amount, message) => {
      expect(await addSettlement(testDb.db, input({ amount }))).toEqual(
        validation({ amount: message }),
      );
      expect(await count()).toBe(0);
    });

    // Security: ids come from hidden form fields and are untrusted.
    it("rejects a payer from another group and inserts nothing", async () => {
      expect(await addSettlement(testDb.db, input({ fromId: inB.id }))).toEqual(
        validation({ fromId: NOT_A_MEMBER }),
      );
      expect(await count()).toBe(0);
    });

    it("rejects a receiver from another group and inserts nothing", async () => {
      expect(await addSettlement(testDb.db, input({ toId: inB.id }))).toEqual(
        validation({ toId: NOT_A_MEMBER }),
      );
      expect(await count()).toBe(0);
    });

    it("rejects ids that are not members anywhere", async () => {
      expect(
        await addSettlement(
          testDb.db,
          input({ fromId: MISSING_ID, toId: MISSING_ID_2 }),
        ),
      ).toEqual(validation({ fromId: NOT_A_MEMBER, toId: NOT_A_MEMBER }));
      expect(await count()).toBe(0);
    });

    it("returns NOT_FOUND for an unknown group and inserts nothing", async () => {
      expect(
        await addSettlement(testDb.db, input({ groupId: MISSING_ID })),
      ).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "Group not found" },
      });
      expect(await count()).toBe(0);
    });

    it("returns VALIDATION for a malformed group id", async () => {
      expect(
        await addSettlement(testDb.db, input({ groupId: "nope" })),
      ).toEqual(validation({ groupId: "Invalid ID" }));
    });

    it("returns VALIDATION for a malformed member id", async () => {
      expect(await addSettlement(testDb.db, input({ fromId: "nope" }))).toEqual(
        validation({ fromId: "Invalid ID" }),
      );
      expect(await count()).toBe(0);
    });

    it("returns every field error at once and inserts nothing", async () => {
      const result = await addSettlement(
        testDb.db,
        input({ fromId: "", toId: "x", amount: "" }),
      );
      expect(
        !result.ok && Object.keys(result.error.fields ?? {}).sort(),
      ).toEqual(["amount", "fromId", "toId"]);
      expect(await count()).toBe(0);
    });

    it("returns UNEXPECTED (logged) when the stored currency is not supported", async () => {
      await testDb.db.group.update({
        where: { id: groupA },
        data: { currency: "XXX" },
      });

      expect(await addSettlement(testDb.db, input())).toEqual({
        ok: false,
        error: { code: "UNEXPECTED", message: UNEXPECTED_MESSAGE },
      });
      expect(await count()).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[settlement]"),
        expect.any(Error),
      );
    });
  });

  describe("listSettlements", () => {
    it("lists newest first and only this group's settlements", async () => {
      // Rows inserted directly with explicit times (same-millisecond inserts
      // would tie), so this tests the read on its own.
      const bob = await member(groupB, "Bob");
      const row = (
        groupId: string,
        fromId: string,
        toId: string,
        amount: bigint,
        createdAt: string,
      ) =>
        testDb.db.settlement.create({
          data: {
            groupId,
            fromId,
            toId,
            amount,
            createdAt: new Date(createdAt),
          },
        });
      await row(groupA, mya.id, aung.id, 100n, "2026-01-01T00:00:00Z");
      await row(groupA, aung.id, mya.id, 200n, "2026-01-02T00:00:00Z");
      await row(groupB, inB.id, bob.id, 500n, "2026-01-03T00:00:00Z");

      expect(await listSettlements(testDb.db, groupA)).toEqual({
        ok: true,
        value: [
          {
            id: expect.any(String),
            fromId: aung.id,
            toId: mya.id,
            amount: { amount: 200n, currency: "MMK" },
          },
          {
            id: expect.any(String),
            fromId: mya.id,
            toId: aung.id,
            amount: { amount: 100n, currency: "MMK" },
          },
        ],
      });
    });

    it("returns shaped settlements only (no groupId or createdAt)", async () => {
      await addSettlement(testDb.db, input());
      const list = await listSettlements(testDb.db, groupA);
      expect(list.ok && list.value.map((s) => Object.keys(s).sort())).toEqual([
        ["amount", "fromId", "id", "toId"],
      ]);
    });

    it("returns an empty list for a group with no settlements", async () => {
      expect(await listSettlements(testDb.db, groupA)).toEqual({
        ok: true,
        value: [],
      });
    });

    it("returns VALIDATION for a malformed id", async () => {
      expect(await listSettlements(testDb.db, "nope")).toEqual(
        validation({ _root: "Invalid ID" }),
      );
    });

    it("returns UNEXPECTED (logged) when the stored currency is not supported", async () => {
      await addSettlement(testDb.db, input());
      await testDb.db.group.update({
        where: { id: groupA },
        data: { currency: "XXX" },
      });

      expect(await listSettlements(testDb.db, groupA)).toEqual({
        ok: false,
        error: { code: "UNEXPECTED", message: UNEXPECTED_MESSAGE },
      });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[settlement]"),
        expect.any(Error),
      );
    });
  });
});

describe("settlement service (database failure)", () => {
  const boom = () => Promise.reject(new Error("boom: disk I/O error"));
  const failingDb = {
    $transaction: boom,
    settlement: { findMany: boom },
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
      "addSettlement",
      () =>
        addSettlement(failingDb, {
          groupId: MISSING_ID,
          fromId: MISSING_ID_2,
          toId: MISSING_ID,
          amount: "1",
        }),
    ],
    ["listSettlements", () => listSettlements(failingDb, MISSING_ID)],
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
        expect.stringContaining("[settlement]"),
        expect.any(Error),
      );
    },
  );
});

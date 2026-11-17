import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { idSchema, parseWith } from "@/lib/validation";
import { createTestDb, type TestDb } from "@/server/testDb";
import { createGroup, getGroup } from "./service";

/** Valid-looking UUID v4 that is never inserted. */
const MISSING_ID = "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b";
const UNEXPECTED_MESSAGE = "Something went wrong. Please try again.";

describe("group service (temp SQLite with migrations applied)", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe("createGroup", () => {
    it("creates a group that getGroup reads back", async () => {
      const created = await createGroup(testDb.db, {
        name: "Trip to Bagan",
        currency: "USD",
      });

      expect(created).toEqual({
        ok: true,
        value: {
          id: expect.any(String),
          name: "Trip to Bagan",
          currency: "USD",
        },
      });
      if (!created.ok) return;
      expect(parseWith(idSchema, created.value.id).ok).toBe(true);
      expect(await getGroup(testDb.db, created.value.id)).toEqual(created);
    });

    it("stores the trimmed name", async () => {
      const created = await createGroup(testDb.db, {
        name: "  Trip  ",
        currency: "MMK",
      });
      expect(created.ok && created.value.name).toBe("Trip");

      const rows = await testDb.db.group.findMany();
      expect(rows.map((row) => row.name)).toEqual(["Trip"]);
    });

    it("round-trips a Burmese name unchanged", async () => {
      const name = "မန္တလေး ခရီးစဉ်";
      const created = await createGroup(testDb.db, { name, currency: "MMK" });
      if (!created.ok) throw new Error("expected ok");

      const read = await getGroup(testDb.db, created.value.id);
      expect(read.ok && read.value.name).toBe(name);
      const row = await testDb.db.group.findUnique({
        where: { id: created.value.id },
      });
      expect(Buffer.from(row!.name)).toEqual(Buffer.from(name));
    });

    it("gives two groups different UUID v4 ids", async () => {
      const a = await createGroup(testDb.db, { name: "A", currency: "MMK" });
      const b = await createGroup(testDb.db, { name: "B", currency: "KHR" });
      if (!a.ok || !b.ok) throw new Error("expected ok");

      expect(a.value.id).not.toBe(b.value.id);
      expect(parseWith(idSchema, a.value.id).ok).toBe(true);
      expect(parseWith(idSchema, b.value.id).ok).toBe(true);
    });

    it.each([
      ["blank name", { name: "", currency: "MMK" }, ["name"]],
      ["whitespace-only name", { name: "   ", currency: "MMK" }, ["name"]],
      ["101-char name", { name: "a".repeat(101), currency: "MMK" }, ["name"]],
      ["bad currency", { name: "Trip", currency: "EUR" }, ["currency"]],
      ["empty object", {}, ["currency", "name"]],
    ])("rejects %s and inserts nothing", async (_, input, expectedFields) => {
      const result = await createGroup(testDb.db, input);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("VALIDATION");
      expect(Object.keys(result.error.fields ?? {}).sort()).toEqual(
        expectedFields,
      );
      expect(await testDb.db.group.count()).toBe(0);
    });

    it.each([[null], ["nope"], [42]])(
      "rejects non-object input %j and inserts nothing",
      async (input) => {
        const result = await createGroup(testDb.db, input);
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error.code).toBe("VALIDATION");
        expect(await testDb.db.group.count()).toBe(0);
      },
    );
  });

  describe("getGroup", () => {
    it("returns NOT_FOUND for a valid id that does not exist", async () => {
      const result = await getGroup(testDb.db, MISSING_ID);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe("NOT_FOUND");
    });

    it.each([["not-an-id"], [""], [` ${MISSING_ID}`], [42], [undefined]])(
      "returns VALIDATION for malformed id %j",
      async (id) => {
        const result = await getGroup(testDb.db, id);
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error.code).toBe("VALIDATION");
      },
    );

    it("returns UNEXPECTED (and logs) when a stored currency is unsupported", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const row = await testDb.db.group.create({
        data: { name: "Old", currency: "EUR" },
      });

      expect(await getGroup(testDb.db, row.id)).toEqual({
        ok: false,
        error: { code: "UNEXPECTED", message: UNEXPECTED_MESSAGE },
      });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});

describe("group service (database failure)", () => {
  const failingDb = {
    group: {
      create: () => Promise.reject(new Error("boom: disk I/O error")),
      findUnique: () => Promise.reject(new Error("boom: disk I/O error")),
    },
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
      "createGroup",
      () => createGroup(failingDb, { name: "Trip", currency: "MMK" }),
    ],
    ["getGroup", () => getGroup(failingDb, MISSING_ID)],
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
        expect.stringContaining("[group]"),
        expect.any(Error),
      );
    },
  );
});

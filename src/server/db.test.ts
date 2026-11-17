import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { idSchema, parseWith } from "@/lib/validation";
import { createTestDb, type TestDb } from "./testDb";

describe("database (temp SQLite with migrations applied)", () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(async () => {
    await testDb.cleanup();
    expect(existsSync(testDb.path)).toBe(false);
  });

  it("uses a temp file, never DATABASE_URL", () => {
    expect(testDb.path.startsWith(tmpdir())).toBe(true);
    expect(`file:${testDb.path}`).not.toBe(process.env.DATABASE_URL);
  });

  it("creates a Group and reads it back", async () => {
    const before = new Date();
    const created = await testDb.db.group.create({
      data: { name: "Trip", currency: "MMK" },
    });
    const after = new Date();

    const found = await testDb.db.group.findUnique({
      where: { id: created.id },
    });

    expect(found).toEqual(created);
    expect(found?.name).toBe("Trip");
    expect(found?.currency).toBe("MMK");
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(found!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("generates ids (Prisma's uuid(4) default) that pass idSchema", async () => {
    const created = await testDb.db.group.create({
      data: { name: "Trip", currency: "MMK" },
    });

    expect(parseWith(idSchema, created.id)).toEqual({
      ok: true,
      value: created.id,
    });
  });

  it("gives two Groups different ids", async () => {
    const a = await testDb.db.group.create({
      data: { name: "A", currency: "USD" },
    });
    const b = await testDb.db.group.create({
      data: { name: "B", currency: "KHR" },
    });

    expect(a.id).not.toBe(b.id);
    expect(await testDb.db.group.count()).toBe(2);
  });
});

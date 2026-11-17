import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/** Builds a Prisma client for a SQLite `file:` URL (path relative to cwd). */
export function createDbClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

// Dev hot reload re-evaluates this module; caching on globalThis keeps one
// client (one SQLite connection) per process instead of one per reload.
const globalForDb = globalThis as typeof globalThis & {
  __db?: PrismaClient;
};

/**
 * App-wide Prisma client, created on first use from DATABASE_URL. Lazy so
 * importing this module (e.g. during `next build`) never needs a database.
 */
export function getDb(): PrismaClient {
  if (globalForDb.__db) return globalForDb.__db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set (e.g. file:./data/dev.db) — see README › Database",
    );
  }

  globalForDb.__db = createDbClient(url);
  return globalForDb.__db;
}

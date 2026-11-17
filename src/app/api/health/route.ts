import { connection } from "next/server";
import { getDb } from "@/server/db";

const NO_STORE = { "Cache-Control": "no-store" };

/** Liveness + DB check: 200 if SQLite answers `SELECT 1`, else 503. */
export async function GET() {
  // Opt out of build-time prerendering (Cache Components): the DB must be
  // checked on every request, not once during `next build`.
  await connection();

  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: NO_STORE });
  } catch (error) {
    console.error("[health] database check failed:", error);
    return Response.json(
      { status: "error" },
      { status: 503, headers: NO_STORE },
    );
  }
}

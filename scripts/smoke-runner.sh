#!/usr/bin/env bash
# Smoke-test the production `runner` image (Dockerfile --target runner).
#
# Starts the image on a NEW, empty named volume and checks that:
#   - it becomes ready (/api/health 200) within a bounded time, and fails
#     fast if the container exits first (e.g. `migrate deploy` failed);
#   - /api/health, / and /groups/new return 200; /dev/components returns 404;
#   - every migration in this repo's prisma/migrations was applied at start;
#   - every effect package in the image has the version in package-lock.json;
#   - PID 1 is node (the entrypoint exec'd), running as the non-root nextjs user.
# On any failure it prints `docker logs` and exits 1.
#
# Usage: scripts/smoke-runner.sh <image>
#   SMOKE_NAME  container name, volume is "$SMOKE_NAME-data" (default share-expense-smoke)
#   SMOKE_PORT  host port, bound to 127.0.0.1 only (default 3300)
#
# It never removes anything (no --rm: an exited container would take its logs
# with it). On exit it only stops its own container, to free the port.
set -euo pipefail

IMAGE="${1:?usage: scripts/smoke-runner.sh <image>}"
NAME="${SMOKE_NAME:-share-expense-smoke}"
PORT="${SMOKE_PORT:-3300}"
VOLUME="$NAME-data"
BASE="http://127.0.0.1:$PORT"
READY_TIMEOUT_SECONDS=60
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

log() { echo "[smoke] $*"; }

fail() {
  echo "[smoke] FAIL: $*"
  echo "[smoke] ---- docker logs $NAME ----"
  docker logs "$NAME" 2>&1 || true
  echo "[smoke] ---- end of docker logs ----"
  exit 1
}

# The volume must be new, so the DB starts empty and the migrations run.
if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "[smoke] FAIL: volume $VOLUME already exists; use another SMOKE_NAME"
  exit 1
fi
docker volume create "$VOLUME" >/dev/null
log "image $IMAGE, container $NAME, volume $VOLUME, port $PORT"

docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" \
  -v "$VOLUME:/app/data" "$IMAGE" >/dev/null
trap 'docker stop "$NAME" >/dev/null 2>&1 || true' EXIT

# --- Readiness: poll once per second, bounded; stop as soon as it exits ---
start=$SECONDS
body=""
while :; do
  state=$(docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' "$NAME")
  if [ "${state% *}" != "running" ]; then
    fail "container ${state% *} (exit code ${state#* }) before it became ready"
  fi
  if body=$(curl -fsS --max-time 2 "$BASE/api/health" 2>&1); then
    break
  fi
  if [ $((SECONDS - start)) -ge "$READY_TIMEOUT_SECONDS" ]; then
    fail "not ready after ${READY_TIMEOUT_SECONDS}s; last /api/health: $body"
  fi
  sleep 1
done
log "ready after $((SECONDS - start))s: $body"

# --- HTTP: path:expected status ---
# /dev/components is a dev-only preview; the build prerenders it as a 404.
for check in /api/health:200 /:200 /groups/new:200 /dev/components:404; do
  path=${check%:*}
  want=${check##*:}
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE$path") ||
    fail "GET $path: no response"
  [ "$code" = "$want" ] || fail "GET $path returned $code, expected $want"
  log "GET $path -> $code"
done

# --- Migrations: applied rows in the DB = migration folders in this repo ---
# Compared with the repo, not the image: `prisma migrate status` inside the
# container would compare against the image's own (possibly empty) folder.
expected=$(find "$REPO_ROOT/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
[ "$expected" -gt 0 ] || fail "no migration folders found in $REPO_ROOT/prisma/migrations"
# Built-in node:sqlite (no dependency). Only stdout is captured; Node may print
# an ExperimentalWarning on stderr, which passes through.
applied=$(docker exec "$NAME" node -e '
const { DatabaseSync } = require("node:sqlite");
const file = process.env.DATABASE_URL.replace(/^file:/, "");
const db = new DatabaseSync(file, { readOnly: true });
const row = db
  .prepare("SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")
  .get();
console.log(row.n);
') || fail "could not read _prisma_migrations"
[ "$applied" = "$expected" ] ||
  fail "applied migrations: $applied, expected $expected (prisma/migrations)"
log "migrations applied: $applied of $expected"

# --- effect: every copy in the image = the version in package-lock.json ---
# The prisma-cli stage installs without the lockfile, so `npm audit` (which
# reads only package-lock.json) does not see what it installed. The lockfile
# goes in on stdin, so the host still needs no node. Prisma's own bundled
# effect inside prisma/build is not a package and is not seen (decisions.md).
effect=$(docker exec -i "$NAME" node -e '
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const lock = JSON.parse(fs.readFileSync(0, "utf8"));
const expected = lock.packages?.["node_modules/effect"]?.version;
const files = execFileSync("find", ["/app", "-path", "*/node_modules/effect/package.json"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
let ok = Boolean(expected) && files.length > 0;
console.log(`expected ${expected ?? "(none: no node_modules/effect)"} from package-lock.json`);
if (files.length === 0) console.log("no effect package found under /app");
for (const file of files) {
  const { version } = JSON.parse(fs.readFileSync(file, "utf8"));
  if (version !== expected) ok = false;
  console.log(`${file.replace(/\/package\.json$/, "")} ${version}${version === expected ? "" : " MISMATCH"}`);
}
process.exit(ok ? 0 : 1);
' <"$REPO_ROOT/package-lock.json") || fail "effect version check:"$'\n'"$effect"
while IFS= read -r line; do log "effect: $line"; done <<<"$effect"

# --- Non-root: check the running process, not just the image's USER ---
# The executable, not comm/cmdline: Next.js sets process.title to
# "next-server (v…)", which rewrites both.
exe=$(docker exec "$NAME" readlink /proc/1/exe)
uid=$(docker exec "$NAME" sed -n 's/^Uid:[[:space:]]*\([0-9]*\).*/\1/p' /proc/1/status)
nextjs_uid=$(docker exec "$NAME" id -u nextjs)
[ "${exe##*/}" = "node" ] || fail "PID 1 is '$exe', expected node"
[ "$uid" != "0" ] || fail "PID 1 runs as root"
[ "$uid" = "$nextjs_uid" ] || fail "PID 1 uid $uid, expected nextjs ($nextjs_uid)"
log "PID 1: $exe, uid $uid (nextjs)"

log "PASS"

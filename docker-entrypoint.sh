#!/bin/sh
# Runner entrypoint: apply pending migrations, then hand PID 1 to node.
set -e

if ! node node_modules/prisma/build/index.js migrate deploy --config prisma7.config.ts; then
  echo "[entrypoint] prisma migrate deploy failed — not starting the server" >&2
  exit 1
fi

exec node server.js

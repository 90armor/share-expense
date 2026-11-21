# syntax=docker/dockerfile:1

# ---- deps: install dependencies once, shared by dev/build stages ----
# node:24-slim (Debian/glibc), not alpine: better-sqlite3 is a native addon and
# alpine's musl libc causes native-module build/runtime issues; slim keeps glibc
# compatibility while staying reasonably small.
FROM node:24-slim AS deps
WORKDIR /app

# Native build toolchain as a fallback for better-sqlite3's prebuild-install
# (used only if no prebuilt binary matches this Debian/Node/arch combination).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ---- dev: used by docker-compose for local development ----
FROM deps AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- build: compile the production standalone output ----
FROM deps AS build
WORKDIR /app
ENV NODE_ENV=production
COPY . .
# Dummy DB URL: `prisma generate` only reads the schema, never connects, but
# prisma7.config.ts's defineConfig still wants DATABASE_URL set or it errors.
ENV DATABASE_URL=file:/tmp/build.db
# Generates src/generated/prisma (gitignored, must be produced in-image).
RUN npx prisma generate --config prisma7.config.ts
# next build needs network access (next/font/google fetches fonts at build
# time) — normal default for `docker build`, documented here, not a blocker.
RUN npm run build

# ---- prisma-cli: only the Prisma CLI (+ dotenv for prisma7.config.ts) ----
# The standalone output has no CLI, but the runner applies migrations at start.
# Versions are read from package.json so they stay pinned to the app's.
# --legacy-peer-deps: don't pull in prisma's peers (better-sqlite3, typescript).
# The app's `overrides` are copied too: this install has no lockfile, so without
# them the CLI would get the unpatched transitive versions (see docs/decisions.md).
FROM node:24-slim AS prisma-cli
WORKDIR /prisma-cli
COPY package.json /tmp/app-package.json
RUN PRISMA_VERSION=$(node -p "require('/tmp/app-package.json').devDependencies.prisma") \
    && DOTENV_VERSION=$(node -p "require('/tmp/app-package.json').dependencies.dotenv") \
    && npm init -y >/dev/null \
    && npm pkg set --json \
       overrides="$(node -p "JSON.stringify(require('/tmp/app-package.json').overrides || {})")" \
    && npm install --no-save --no-package-lock --legacy-peer-deps \
       "prisma@${PRISMA_VERSION}" "dotenv@${DOTENV_VERSION}"

# ---- runner: minimal production image, non-root ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# SQLite file lives in /app/data — mount a volume or host folder there.
ENV DATABASE_URL=file:/app/data/app.db

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /app/data \
    && chown nextjs:nodejs /app/data
# ^ SQLite needs a writable directory (journal file), not just a writable
#   file. A fresh named volume copies this ownership on first mount.

# Prisma CLI first, so the standalone output's traced files win on overlap.
COPY --from=prisma-cli /prisma-cli/node_modules ./node_modules
# Next.js standalone output: minimal server.js + pruned node_modules.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Prisma client uses a custom output path (outside node_modules) — copy
# explicitly rather than rely on the standalone tracer to catch it.
COPY --from=build --chown=nextjs:nodejs /app/src/generated ./src/generated
# What `prisma migrate deploy` needs at start.
COPY --from=build /app/prisma7.config.ts ./
COPY --from=build /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build /app/prisma/migrations ./prisma/migrations
COPY --from=build --chmod=755 /app/docker-entrypoint.sh ./

USER nextjs
EXPOSE 3000
# Migrate, then `exec node server.js` (node becomes PID 1 and gets signals).
CMD ["./docker-entrypoint.sh"]

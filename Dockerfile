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

# ---- runner: minimal production image, non-root ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output: minimal server.js + pruned node_modules.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Prisma client uses a custom output path (outside node_modules) — copy
# explicitly rather than rely on the standalone tracer to catch it.
COPY --from=build --chown=nextjs:nodejs /app/src/generated ./src/generated

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

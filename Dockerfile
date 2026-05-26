# syntax=docker/dockerfile:1.7
# ============================================================
#  Aquashield Restoration LLC NestJS 11 — multi-stage Dockerfile (linear pipeline)
#
#  Stages:
#    1. deps     → npm ci (incl. dev) — cached
#    2. build    → prisma generate + nest build, then `npm prune --omit=dev`
#    3. runtime  → node:alpine + dumb-init, copies pruned node_modules + dist
#
#  Notes:
#    - Prisma 7 prisma-client generator emits TypeScript under
#      src/generated/prisma → compiled into dist/generated/prisma by nest build.
#    - Driver adapter (@prisma/adapter-pg + pg) → no engine binaries needed.
#    - Final image runs as user `node` (UID 1000) on port 8080.
# ============================================================

ARG NODE_VERSION=22.12.0-alpine3.20
ARG DATABASE_URL


# ------------------------------------------------------------
#  1) deps — install everything (dev + prod)
# ------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./

# Diagnostic: surface node/npm versions in the build log.
RUN node --version && npm --version

# Use npm install instead of ci for more flexibility with lock file sync.
# The cache mount speeds up rebuilds but is optional.
RUN --mount=type=cache,target=/root/.npm,id=npm,cacheKey=npm-cache \
    npm install


# ------------------------------------------------------------
#  2) build — generate Prisma client, compile NestJS, then prune devDeps
# ------------------------------------------------------------
FROM node:${NODE_VERSION} AS build
WORKDIR /app

RUN apk add --no-cache openssl

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client BEFORE tsc so dist/generated/prisma exists.
RUN npx prisma generate

# Nest build → dist/
RUN npm run build

# Drop devDependencies in-place so we can reuse this node_modules at runtime.
RUN --mount=type=cache,target=/root/.npm,id=npm,cacheKey=npm-cache \
    npm prune --omit=dev


# ------------------------------------------------------------
#  3) runtime — final minimal image
# ------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

RUN apk add --no-cache dumb-init openssl wget

ENV NODE_ENV=production \
    PORT=8080

COPY --from=build --chown=node:node /app/node_modules    ./node_modules
COPY --from=build --chown=node:node /app/dist            ./dist
COPY --from=build --chown=node:node /app/package.json    ./package.json
# Prisma assets — kept so `prisma db ...` can run inside the container if needed.
COPY --from=build --chown=node:node /app/prisma          ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts

USER node

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/main.js"]

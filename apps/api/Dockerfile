# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# UK Energy API — local-test container
#
# Multi-stage Node 22 Alpine image:
#   1. `deps`   — install workspace deps (root + apps/api + packages/shared)
#   2. `runner` — copy source + node_modules, run Hono server on :3000
#
# Build context MUST be the repo root (we use npm workspaces and packages/shared).
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app

# HUSKY=0 prevents the root `prepare` script from failing on git-less containers.
ENV HUSKY=0

# Copy workspace manifests first to cache the npm install layer.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install ALL deps (incl. dev — tsx is a devDep we need at runtime here).
# npm hoists workspace deps into the root node_modules, so the per-workspace
# node_modules dirs may not exist. Create empty placeholders so the runner
# stage's COPY commands always succeed.
RUN npm ci --ignore-scripts && \
    mkdir -p apps/api/node_modules packages/shared/node_modules

# ---------------------------------------------------------------------------

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--enable-source-maps"

# wget for the docker-compose healthcheck (uses busybox wget on Alpine).
RUN apk add --no-cache wget

# Copy hoisted node_modules + any workspace-local node_modules from deps stage.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source — keep monorepo layout so npm workspaces resolve correctly.
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY data ./data

# Non-root for container security.
RUN chown -R node:node /app
USER node

EXPOSE 3000
WORKDIR /app/apps/api
# `npx --no-install tsx` resolves the locally-installed tsx binary (deps stage
# installed it). The --no-install flag prevents npx from trying to reach the
# registry on first invocation.
CMD ["npx", "--no-install", "tsx", "src/server.ts"]

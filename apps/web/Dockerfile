# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# UK Energy Dashboard — local-test container
#
# Multi-stage:
#   1. `builder` — Node 22 Alpine: install deps, vite build → static dist/
#   2. `runner`  — nginx Alpine: serves dist/ + proxies /api/* to api:3000
#
# Build context MUST be the repo root (workspace + packages/shared).
# ---------------------------------------------------------------------------

FROM node:22-alpine AS builder
WORKDIR /app

ENV HUSKY=0

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Build the Vite SPA into apps/web/dist
RUN npm run build -w @uk-energy/web

# ---------------------------------------------------------------------------

FROM nginx:1.27-alpine AS runner

# Replace default nginx config with our SPA + API-proxy config.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Drop the build output into nginx's web root.
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

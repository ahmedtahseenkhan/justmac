# syntax=docker/dockerfile:1.7
# One Dockerfile, two targets (api, web) sharing a single dependency install.
# Build context = repo root.

FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install deps ONCE, cached on the pnpm store mount. Copy only manifests first so
# editing source doesn't bust the (slow) install layer.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Sources + the shared package (needed by both apps).
COPY . .
RUN pnpm --filter @sellme/shared build

# ---- API runtime ----
FROM base AS api
# Raise the V8 heap for the build: on small hosts (≤1GB RAM) Node auto-sets a
# ~256MB old-space limit and the nest/tsc compile OOMs. Needs swap on the host
# to back it. Scoped to the build RUN so it doesn't affect the runtime process.
RUN pnpm --filter @sellme/api exec prisma generate \
 && NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @sellme/api build
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]

# ---- Web runtime ----
FROM base AS web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Same heap headroom for the Next.js production build (see API note above).
RUN NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @sellme/web build
ENV NODE_ENV=production
WORKDIR /app/apps/web
EXPOSE 3100
CMD ["pnpm", "start"]

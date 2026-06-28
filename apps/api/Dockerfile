# JustMac API (NestJS). Build context = repo root (monorepo).
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @sellme/shared build \
 && pnpm --filter @sellme/api exec prisma generate \
 && pnpm --filter @sellme/api build

FROM node:22-slim AS run
WORKDIR /app
RUN corepack enable && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Bring over the whole built workspace (node_modules incl. generated Prisma client,
# the compiled API, the prisma schema + seed, and the built shared package).
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]

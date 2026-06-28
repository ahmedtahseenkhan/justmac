# JustMac web (Next.js). Build context = repo root (monorepo).
# NEXT_PUBLIC_API_URL is baked into the client bundle at build time, so it must
# be the PUBLIC URL the browser will use to reach the API (e.g. http://<host>:4000).
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @sellme/shared build \
 && pnpm --filter @sellme/web build

ENV NODE_ENV=production
WORKDIR /app/apps/web
EXPOSE 3100
CMD ["pnpm", "start"]

# Deploying JustMac to a single EC2 host (Docker)

This runs everything — Next.js web, NestJS API, Postgres, Redis — on one box with
Docker Compose. Good for a demo / small production.

There are two ways to get the app images onto the host:

- **Path 1 — prebuilt images (recommended, esp. on a box with slow/flaky internet):**
  GitHub Actions builds the images and the host just **pulls** them. No `pnpm install`
  on the box. See **"Prebuilt images"** below.
- **Path 2 — build on the host:** `docker compose ... up --build`. Simpler but needs a
  fast, reliable connection to npm (it installs ~480 packages). See "Build on the host".

---

## Prebuilt images (recommended)

**One-time, on GitHub:**
1. Set the repo Variable `NEXT_PUBLIC_API_URL` to the public API URL the browser will use,
   e.g. `http://<EC2_PUBLIC_IP>:4000` (Repo → Settings → Secrets and variables → Actions →
   Variables → New variable). Or via CLI: `gh variable set NEXT_PUBLIC_API_URL -b "http://<IP>:4000"`.
2. Run the **"Build & publish images"** workflow (Actions tab → Run workflow), or just push
   to `main`. It publishes `ghcr.io/<you>/justmac-api` and `…/justmac-web`.
3. Make both packages **public** once (GitHub → your profile → Packages → each package →
   Package settings → Change visibility → Public). Then the host can pull without logging in.

**On the EC2 host:**
```bash
cd ~/justmac && git pull
cp deploy/.env.prod.example deploy/.env.prod && nano deploy/.env.prod   # set passwords, JWT_SECRET, URLs, GHCR_OWNER
docker compose -f deploy/docker-compose.deploy.yml --env-file deploy/.env.prod pull
docker compose -f deploy/docker-compose.deploy.yml --env-file deploy/.env.prod up -d
# first-time DB init:
docker compose -f deploy/docker-compose.deploy.yml --env-file deploy/.env.prod \
  exec api sh -lc "pnpm exec prisma db push && pnpm run seed"
```
To update later: re-run the workflow (or push to main), then on the host
`docker compose -f deploy/docker-compose.deploy.yml --env-file deploy/.env.prod pull && up -d`.

---

## Build on the host

## 0. Sizing & prerequisites

- **Instance:** t3.medium or larger (4 GB RAM). The Next.js build needs memory — on a
  2 GB t3.small it can OOM; if you must use 2 GB, add swap first:
  ```bash
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  ```
- **Security group:** open inbound **22** (SSH), **3100** (web), **4000** (API).
  (Add **80/443** later if you put Nginx in front.)
- **Docker + Compose plugin** (skip if `docker compose version` already works):
  ```bash
  sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
  sudo usermod -aG docker $USER && newgrp docker
  ```

## 1. Get the code & configure

```bash
cd ~/justmac
git pull                                   # gets the deploy/ files + Dockerfiles
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod
```

In `deploy/.env.prod` set:
- `POSTGRES_PASSWORD` — a strong password (and mirror it inside `DATABASE_URL`).
- `JWT_SECRET` — run `openssl rand -hex 32` and paste the result.
- `API_CORS_ORIGIN` — `http://<EC2_PUBLIC_IP>:3100` (or your https domain).
- `NEXT_PUBLIC_API_URL` — `http://<EC2_PUBLIC_IP>:4000` (or your https API domain).

> `NEXT_PUBLIC_API_URL` is **baked into the web build**, so if you change it later you must
> rebuild web (`docker compose ... up -d --build web`).

## 2. Build & start

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

## 3. Initialise the database (first deploy only)

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod \
  exec api sh -lc "pnpm exec prisma db push && pnpm run seed"
```

This creates the schema and seeds the Apple catalog + demo accounts.

## 4. Open it

- Storefront: `http://<EC2_PUBLIC_IP>:3100`
- Back office: `http://<EC2_PUBLIC_IP>:3100/admin/login`
  - `owner@justmac.test` / `owner1234` (admin) · `staff@justmac.test` / `staff1234`

## 5. Lock it down (do before real use)

- Change the seeded admin/staff passwords (Back office → Staff & roles), or edit the seed.
- Confirm `JWT_SECRET` is a random value (not the dev default).
- Restrict the security group to your IP while testing.

## Updating after new commits

```bash
cd ~/justmac && git pull
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
# run step 3 again only if the Prisma schema changed (db push is safe/idempotent)
```

## Common commands

```bash
# logs
docker compose -f deploy/docker-compose.prod.yml logs -f api
docker compose -f deploy/docker-compose.prod.yml logs -f web
# status / restart / stop
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml restart api
docker compose -f deploy/docker-compose.prod.yml down          # stop (keeps DB volume)
```

## Optional: domain + HTTPS (Nginx + Let's Encrypt)

Point `web.yourdomain.com` → web:3100 and `api.yourdomain.com` → api:4000, then set
`NEXT_PUBLIC_API_URL=https://api.yourdomain.com` and `API_CORS_ORIGIN=https://web.yourdomain.com`
and rebuild. Easiest is `caddy` (auto-HTTPS) or `nginx` + `certbot`. Ask if you want a
ready-made reverse-proxy config added to `deploy/`.

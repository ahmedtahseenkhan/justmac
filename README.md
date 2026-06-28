# JustMac — Electronics Trade-In Platform

> Brand: **JustMac** — *Smart tech. Smarter savings.* (Internal package names remain
> `@sellme/*` and the repo dir is `sellme/` — technical identifiers, not user-facing.)

The "prove the loop" MVP from the build spec: browse a device → get an instant,
**transparent** cash quote → add it to your box → check out → track the trade-in
through its lifecycle. Phones-only seed data; built to widen to all categories.

## Stack

| Layer    | Tech                                                        |
| -------- | ---------------------------------------------------------- |
| Web      | Next.js 14 (App Router) + TypeScript + Tailwind            |
| API      | NestJS + Prisma                                            |
| Pricing  | Isolated module inside the API (clean extraction path → microservice) |
| Data     | PostgreSQL                                                 |
| Cache    | Redis (with in-memory fallback if `REDIS_URL` is unset)    |
| Contracts| `@sellme/shared` — zod schemas + types shared by web & API |

## Monorepo layout

```
apps/
  api/   NestJS — catalog, pricing, quote, orders + lifecycle state machine
  web/   Next.js — home, catalog/search, quote wizard, cart, checkout, track
packages/
  shared/  Typed quote/lifecycle/catalog/order contracts (zod)
```

## Prerequisites

- Node ≥ 20, pnpm ≥ 9, Docker (for Postgres + Redis)
- Ports used: web `3000`, api `4000`, Postgres `5433`, Redis `6380`
  (non-standard DB/Redis ports to avoid clashing with anything already running)

## Quickstart

```bash
cp .env.example .env          # already done if you cloned fresh
pnpm setup                    # install, build shared, generate client, start DB, push schema, seed
pnpm dev                      # runs api (4000) + web (3000) together
```

Then open **http://localhost:3000**.

`pnpm setup` runs:
1. `pnpm install`
2. build `@sellme/shared`
3. `prisma generate`
4. `docker compose up -d postgres redis`
5. `prisma db push` (schema → DB)
6. seed phones (Apple + Samsung) with condition trees and base prices

### Useful scripts

| Command            | What                                            |
| ------------------ | ----------------------------------------------- |
| `pnpm dev`         | api + web in parallel                           |
| `pnpm db:up`       | start Postgres + Redis                          |
| `pnpm db:seed`     | re-seed catalog                                 |
| `pnpm db:reset`    | drop + recreate + (run seed manually after)     |
| `pnpm build`       | build all packages                              |

## The loop, end to end

1. **/sell** — fuzzy type-ahead over the catalog; each card shows "Cash up to $X".
2. **/sell/[model]** — the wizard: variant → cosmetic → functional → battery →
   accessories → carrier/lock → guided photos → **instant offer**.
3. **Offer** — shows the full **transparent breakdown** (base × market × age ×
   condition − margin, with floor/ceiling guardrails), a **confidence band**, and a
   30-day **quote lock** countdown. Every answer is editable inline.
4. **/cart** — "Your Box": multi-device, per-line + total payout.
5. **/checkout** — account → payout method (ACH/PayPal/check/Zelle) → shipping →
   Fair-Evaluation terms. Issues a (stub) prepaid label.
6. **/track/[id]** — the lifecycle timeline. A demo control advances the state
   machine (`QUOTE_LOCKED → … → PAID`) standing in for carrier webhooks + back-office.

## The pricing engine (core IP)

- Pure function: [`apps/api/src/pricing/pricing.engine.ts`](apps/api/src/pricing/pricing.engine.ts)
  — `fair = base × market × depreciation × Π(condition multipliers)`, then
  `offer = clamp(fair × (1 − margin), floor, ceiling)`, returning a line-by-line breakdown.
- Service: [`pricing.service.ts`](apps/api/src/pricing/pricing.service.ts) resolves
  inputs from the DB and caches priced configs in Redis (60s TTL → "live"-feeling quotes).
- Market + depreciation are deterministic stand-ins for MVP; swap in live feeds
  (`MarketFeed` / `DepreciationModel`) without changing the engine signature.

## Phase 2 — trust & ops (built)

The back-office and post-inspection trust loop, all wired through the state machine:

- **Inspection back-office** at **/ops** — a grading queue. Intake a shipment by serial/IMEI
  (creates the physical `Device`, runs screening), then grade each device. Grading
  **re-prices against the inspector's actual condition** and decides
  `OFFER_CONFIRMED` (matches/beats the quote) vs `OFFER_ADJUSTED` (worse).
  A NIST wipe-certificate URL is stamped at grading.
- **Fair-Evaluation flow** — on the **/track** page the seller sees the confirmed or
  adjusted offer (original struck through vs. proposed) and the inspector's findings,
  then **Accept** (→ `ACCEPTED` → idempotent payout → `PAID`) or **Reject** an adjusted
  offer (→ `REJECTED` → `RETURNED`, free return shipping).
- **Eligibility / fraud screening** at intake — activation-lock, MDM, carrier blacklist,
  serial-vs-model mismatch, and velocity (re-submitted serial). Deterministic stubs you
  can trigger with serial prefixes: `LCK…` lock, `MDM…` MDM, `BLK…` blacklist, `MIS…`
  mismatch. Flags surface on /track and /ops; ineligible devices are marked.
- **Notifications** — templated email + SMS fired on every lifecycle transition,
  persisted and shown as an activity feed on /track. Providers are stubbed to the logger.

Try it: place an order → check out → open **/ops**, intake with serial `LCK123` to see a
screening flag (or any serial to pass), grade the device worse than quoted to force an
adjustment, then **/track** the order to accept or reject.

## Phase 3 — margin & scale (built)

Closes the loop the spec calls the real business — *"the downstream resale channel
determines your real margin."*

- **Resale storefront** at **/shop** — Certified Pre-Owned catalog with grade labels +
  warranty, product pages, a resale cart, and card/PayPal checkout (stubbed). Every
  `Listing` links 1:1 to its acquisition `Device`, so each unit is traceable
  **bought → graded → wiped → refurbished → listed → sold**.
- **Refurbish & list** at **/ops/resale** — PAID devices appear in a refurb queue with an
  engine-**suggested resale price** (acquisition cost ÷ category margin). List with a
  grade, warranty, and price; it goes live on the storefront.
- **Margin reporting** — a dashboard on /ops/resale: units sold, revenue, **gross margin
  and margin %**, plus a per-unit paid-vs-sold table. This is where the spread is visible.
- **Promo engine** — `PromoCode`s as **buyback bonuses** (e.g. `PHONE5` +5% on phone
  payouts, `MAC10` +10% on laptops) and **resale discounts** (`WELCOME10` 10% off,
  `SAVE25` $25 off). Scope-aware (category-specific) and validated at both checkouts.
- **Dynamic market layer** — an editable `MarketFeed` factor per model now feeds the
  pricing engine (replacing the deterministic stub); seeded hotter/softer per model.
- **More categories** — **Laptops** added (MacBook Air/Pro, Dell XPS) with their own
  config dimensions (processor/RAM/storage/year) and a distinct condition tree
  (no carrier-lock; keyboard/ports + battery-cycle checks). Grading in /ops is now
  **model-driven**, so each device type grades on its own dimensions.

Try the full loop: trade in a phone (apply `PHONE5` at checkout) → **/ops** intake +
grade → accept on **/track** to reach PAID → **/ops/resale** list it → **/shop** buy it
(apply `WELCOME10`) → watch the margin update on /ops/resale.

## Admin pricing console (built)

The spec's "core IP" — the constantly-updated pricing matrix — now has a back-office UI at
**/admin/pricing**:

- **Live simulator** — pick a model + variant + condition grades and see exactly what it
  would pay out *right now*, with the full breakdown (bypasses the quote cache).
- **Category margins** — edit the target margin per category; payouts recompute immediately.
- **Base values + guardrails** — edit base/floor/ceiling per variant. Edits are
  **versioned** (the old `PriceBase` row is effective-dated out, a new one inserted), so the
  matrix keeps full price history.
- **Market feeds** — edit the live demand factor per model; feeds the pricing engine.
- **Bulk upload** — paste or upload CSV (`modelSlug,variantLabel,base,floor,ceiling`);
  per-row results and errors reported.

Endpoints under `/api/admin/pricing` (`categories`, `models`, `categories/:id/margin`,
`models/:id/feed`, `variants/:id/price`, `bulk`, `simulate`). All would sit behind admin
auth + RBAC + audit logging in production.

## Phase 4 — B2B / Bulk / ITAD (built)

For business customers retiring fleets, at **/b2b**:

- **Bulk buyback** — upload a CSV manifest (`modelSlug,variantLabel,serial`) of 10+ devices.
  Each device is priced through the engine (preliminary, subject to inspection), and a
  **net-terms invoice** is raised (`INV-…`, due date from the account's terms).
- **ITAD / data destruction** — same intake, but no payout: each device gets a **NIST wipe +
  physical-destruction certificate** and a full **chain-of-custody** trail.
- **Relationship-manager routing** — batches are auto-routed by volume (SMB < 10 ≤ Mid-Market
  < 50 ≤ Enterprise).
- **Manager dashboard** at **/b2b/batches** — every batch with company, type, device/matched
  counts, value, manager, and status; drill into a batch for the per-device certificate +
  custody detail.

Endpoints: `POST /api/b2b/batches`, `GET /api/b2b/batches`, `GET /api/b2b/batches/:reference`.
(CSV parsing is client-side; XLSX is a parser swap. Invoices are recorded, not sent.)

## Phase 4 — growth levers (built)

- **Instant / same-day payout** — an upsell at buyback checkout. A small fee
  (1.5%, min $2) is deducted from the payout; the seller sees the net "You receive"
  amount, and the fee is netted out at settlement.
- **Affiliate program** at **/affiliates** — tracked referral links
  (`/sell?ref=CODE`). A click increments the partner's CTR; when a referred order is
  **paid**, a commission (their `ratePct` of the payout) is credited — idempotent per
  order. Dashboard shows clicks, conversions, and earnings; new partners can be added.
- **Price-watch alerts** at **/price-watch** — "notify me if this device's quote rises
  above $X." Created from any quote's offer screen; a checker job (`POST
  /api/price-watch/run`, run from the page) re-prices every active watch and fires the
  ones that crossed their threshold.

## Back office — authenticated super-admin (built)

Everything operational now lives behind a real login at **/admin**, with role-based access.

- **Auth + RBAC** — JWT login ([auth module](apps/api/src/auth/)); two roles: **ADMIN** (full)
  and **OPS_STAFF** (orders/grading/resale only). Every operational endpoint is guarded
  (`JwtAuthGuard` + `RolesGuard`); `middleware.ts` gates `/admin/*` in the browser. Public
  customer endpoints (quote, checkout, track, shop, bulk-quote intake) stay open.
- **Unified shell** — dark sidebar + topbar, role-gated nav, at **/admin**. Customer
  header/footer no longer expose admin links (a discreet "Staff login" lives in the footer).
- **Dashboard** (`/admin`) — KPIs: awaiting-action, paid out, gross margin, live listings,
  catalogue size, affiliate owed, B2B batches, orders-by-status.
- **Orders** (`/admin/orders`) — searchable/paginated list + detail with the full lifecycle
  and advance/Fair-Evaluation controls.
- **Catalog Manager** (`/admin/catalog`) — the previously-missing piece, now full CRUD:
  **Add device** (Category/Brand/**Model** + **variants + prices** + a **condition tree**,
  with Phone/Laptop templates) and **Edit** any existing device (`/admin/catalog/:id/edit`)
  — rename, change brand/category, add/remove/rename variants, edit base/floor/ceiling
  prices (versioned), and edit the condition questions/options/multipliers, each with its
  own Save. Changes go live on `/sell` and in quotes instantly.
- Plus **Operations** (grading queue), **Resale**, **Pricing**, **Promos**, **B2B**,
  **Affiliates**, **Price-watch**, and **Staff & roles** (ADMIN-only sections hidden for staff).

**Sign in** (seeded): `owner@justmac.test` / `owner1234` (admin) · `staff@justmac.test` /
`staff1234` (staff).

> Security note: this is a demo-grade boundary. The JWT lives in a JS-readable cookie so the
> client admin pages work simply; the real enforcement is the API's JWT + RBAC guards. For
> production, move to an HttpOnly-cookie BFF (noted in the plan).

## API surface

```
GET  /api/catalog/categories
GET  /api/catalog/models?q=&category=
GET  /api/catalog/models/:slug
POST /api/quote                       { variantId, conditions[] } → offer + breakdown
POST /api/orders                      { email, payoutMethod, promoCode?, items[] } → order + label
GET  /api/orders/:trackingId          → order + devices + inspection + notifications
POST /api/orders/:trackingId/advance  { to, note }            (back-office / demo)
POST /api/orders/:trackingId/respond  { decision: ACCEPT|REJECT }   (Fair-Evaluation)
GET  /api/ops/queue                   → orders in the grading pipeline
POST /api/ops/orders/:trackingId/intake { serial, imei? }    → receive + screen
POST /api/ops/items/:orderItemId/inspect { inspector, gradedConditions[], findings? }
GET  /api/promo/validate?code=&kind=&subtotal=&categories=   → promo preview
GET  /api/shop?category=              → listed Certified Pre-Owned stock
GET  /api/shop/:sku                   → listing detail
POST /api/resale/checkout             { buyerEmail, payMethod, promoCode?, listingIds[] } → sale
GET  /api/resale/refurb-queue         → PAID devices awaiting listing
POST /api/resale/devices/:deviceId/list { grade, warrantyMonths, price } → listing
GET  /api/resale/margins              → revenue / acquisition cost / gross margin
```

## What's stubbed vs. real (MVP boundaries)

Real: catalog, pricing engine + breakdown + guardrails, quote lock & persistence,
cart, checkout, order + immutable quote snapshots, lifecycle state machine with
enforced transitions, audit events. **Phase 2:** inspection back-office (intake,
screening, grading, re-price → confirm/adjust), Fair-Evaluation accept/reject + free
return, eligibility/fraud screening, idempotent payout, and email/SMS notifications.

Stubbed (provider seams left in place): shipping-label + return-label generation,
real IMEI/blacklist provider (screening is deterministic), payment rails (payout is
recorded, not moved), photo upload (photos stay client-side), the wipe certificate PDF,
auth/OAuth, the resale storefront, B2B/ITAD, and the admin pricing console UI.

**Phase 3:** the resale storefront (listing → shop → sale) with full acquisition→sale
traceability, margin reporting, the promo engine (buyback bonus + resale discount),
DB-backed editable market feeds in the pricing engine, and a second category (laptops)
with model-driven grading.

Stubbed boundaries are honest: each is a single service swap (e.g. `ScreeningService.lookup`,
`NotificationsService` channels, the label/payout calls in `OrdersService`, the card/PayPal
charge in `ResaleService.checkout`).

The **admin pricing console** (base values, margins, floors/ceilings, market feeds, bulk
upload, simulator) is now built at /admin/pricing.

**Phase 4 (so far):** B2B/Bulk/ITAD (bulk buyback + net-terms invoicing, ITAD with
destruction certs + chain-of-custody, RM routing); instant/same-day payout; affiliate
program; price-watch alerts.

Remaining (not yet built): back-office **auth/RBAC** + automated tests, additional **real
payout rails**, multi-region, and a native app. (Native app, real payment/shipping/IMEI
rails, and multi-region need external credentials and can only be stubbed in this
environment.)

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import type {
  MarketOverviewDto,
  MarketSnapshotDto,
  MarketSource,
  MarketSyncConfigDto,
  MarketSyncRunResult,
  PriceProposalDto,
  UpdateMarketSyncConfigRequest,
  UpsertMarketLinkRequest,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ScrapeFetcherService } from "./scrape-fetcher.service";
import { parseBackmarketPrice } from "./backmarket.parser";
import {
  parseBackmarketSearch,
  scoreCandidate,
  toSearchTokens,
} from "./backmarket-search.parser";
import {
  SHOPIFY_SOURCES,
  parseShopifyProduct,
  parseShopifySuggest,
  shopifySourceForUrl,
  toShopifyProductRequest,
} from "./shopify.parser";

const CONFIG_ID = "default";
const SCHEDULER_TICK_MS = 10 * 60 * 1000; // check every 10 min whether a run is due
const BETWEEN_FETCHES_MS = 1500; // polite spacing between page fetches
// Below this dollar move we record the snapshot but skip the proposal — avoids
// churning a new PriceBase row every week for a price that didn't really move.
const MIN_MEANINGFUL_MOVE = 1;

@Injectable()
export class MarketPriceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketPriceService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: ScrapeFetcherService,
  ) {}

  /* ------------------------------ scheduler ------------------------------ */

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), SCHEDULER_TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const config = await this.getConfigRow();
      if (!config.enabled) return;
      const now = new Date();
      if (!config.nextRunAt) {
        // First enable: schedule the initial run one cadence out (admins use "Run now" for an immediate pull).
        await this.prisma.marketSyncConfig.update({
          where: { id: CONFIG_ID },
          data: { nextRunAt: addDays(now, config.cadenceDays) },
        });
        return;
      }
      if (config.nextRunAt <= now) await this.runSync();
    } catch (e) {
      this.logger.error(`Scheduler tick failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  /* ------------------------------ config ------------------------------ */

  private async getConfigRow() {
    return this.prisma.marketSyncConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID },
      update: {},
    });
  }

  async getConfig(): Promise<MarketSyncConfigDto> {
    return toConfigDto(await this.getConfigRow());
  }

  async updateConfig(req: UpdateMarketSyncConfigRequest): Promise<MarketSyncConfigDto> {
    const current = await this.getConfigRow();
    const updated = await this.prisma.marketSyncConfig.update({
      where: { id: CONFIG_ID },
      data: {
        ...req,
        // Re-anchor the next run when the cadence changes (from the last run if any).
        ...(req.cadenceDays && req.cadenceDays !== current.cadenceDays
          ? { nextRunAt: addDays(current.lastRunAt ?? new Date(), req.cadenceDays) }
          : {}),
      },
    });
    return toConfigDto(updated);
  }

  /* ------------------------------ links ------------------------------ */

  async upsertLink(variantId: string, req: UpsertMarketLinkRequest) {
    const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException("Variant not found");
    const source = shopifySourceForUrl(req.url)?.source ?? "BACKMARKET";
    await this.prisma.externalProductLink.upsert({
      where: { variantId },
      create: { variantId, url: req.url, active: req.active, source },
      update: { url: req.url, active: req.active, source },
    });
    return { ok: true };
  }

  async deleteLink(variantId: string) {
    await this.prisma.externalProductLink.deleteMany({ where: { variantId } });
    return { ok: true };
  }

  /**
   * Search Back Market for pages matching a variant and rank the candidates, so
   * the admin picks from suggestions instead of hunting for the URL by hand.
   */
  async suggestLinks(variantId: string) {
    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
      include: { model: { include: { brand: true } } },
    });
    if (!variant) throw new NotFoundException("Variant not found");

    const attrs = Object.values((variant.attributes as Record<string, string>) ?? {});
    const brand = variant.model.brand.name;
    // Skip the brand when the model name already includes it ("Apple Watch SE").
    const modelPart = variant.model.name.toLowerCase().includes(brand.toLowerCase())
      ? variant.model.name
      : `${brand} ${variant.model.name}`;
    const query = [modelPart, ...attrs].join(" ");
    const base = process.env.BACKMARKET_BASE_URL ?? "https://www.backmarket.com";
    const searchUrl = `${base}/en-us/search?q=${encodeURIComponent(query)}`;

    // The public search URL always points at backmarket.com — it's the browser fallback
    // shown to the admin, never proxied.
    const publicSearchUrl = `https://www.backmarket.com/en-us/search?q=${encodeURIComponent(query)}`;
    const tokens = toSearchTokens(variant.model.brand.name, variant.model.name, ...attrs);
    const candidates: { url: string; title: string; score: number; source: string }[] = [];
    const errors: string[] = [];

    // Shopify marketplaces (Gazelle, plug.tech): public suggest endpoints, no proxy.
    // Their search is strict-AND and titles are model-first ("iPhone 11 64GB"), so the
    // brand prefix would zero out results — query with model + attributes only.
    const shopifyQuery = [variant.model.name, ...attrs].join(" ");
    await Promise.all(
      SHOPIFY_SOURCES.map(async (s) => {
        const suggestUrl = `https://${s.host}/search/suggest.json?q=${encodeURIComponent(
          shopifyQuery,
        )}&resources%5Btype%5D=product&resources%5Blimit%5D=8`;
        const fetched = await this.fetcher.fetchPage(suggestUrl, { direct: true });
        if (!fetched.ok) {
          errors.push(`${s.source}: ${fetched.error}`);
          return;
        }
        try {
          for (const c of parseShopifySuggest(JSON.parse(fetched.html), `https://${s.host}`)) {
            candidates.push({ ...c, score: scoreCandidate(c.title, tokens), source: s.source });
          }
        } catch {
          errors.push(`${s.source}: suggest endpoint did not return JSON`);
        }
      }),
    );

    // Back Market: HTML search page, needs the scraping proxy.
    const fetched = await this.fetcher.fetchPage(searchUrl);
    if (fetched.ok) {
      for (const c of parseBackmarketSearch(fetched.html, base)) {
        candidates.push({ ...c, score: scoreCandidate(c.title, tokens), source: "BACKMARKET" });
      }
    } else {
      const proxyHint = process.env.SCRAPER_PROXY_URL
        ? ""
        : " (no scraping proxy configured — set SCRAPER_PROXY_URL)";
      errors.push(`BACKMARKET: ${fetched.error}${proxyHint}`);
    }

    const ranked = candidates
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (ranked.length === 0) {
      return {
        query,
        searchUrl: publicSearchUrl,
        candidates: [],
        error: errors.length ? errors.join(" · ") : "No matching products found",
      };
    }
    // Partial failures (usually Back Market without a proxy) don't block the rest.
    return { query, searchUrl: publicSearchUrl, candidates: ranked, error: null };
  }

  /* ------------------------------ sync ------------------------------ */

  /** Fetch every active link (or one variant's), snapshot, and propose/apply price changes. */
  async runSync(variantId?: string): Promise<MarketSyncRunResult> {
    if (this.running) throw new BadRequestException("A sync is already running");
    this.running = true;
    const result: MarketSyncRunResult = {
      fetched: 0,
      succeeded: 0,
      failed: 0,
      autoApplied: 0,
      pendingReview: 0,
      unchanged: 0,
    };
    try {
      const config = await this.getConfigRow();
      const links = await this.prisma.externalProductLink.findMany({
        where: { active: true, ...(variantId ? { variantId } : {}) },
      });
      if (variantId && links.length === 0) {
        throw new NotFoundException("No active Back Market link for this variant");
      }

      for (let i = 0; i < links.length; i++) {
        if (i > 0) await sleep(BETWEEN_FETCHES_MS);
        const link = links[i];
        result.fetched += 1;

        const fetchOutcome = await this.fetchPrice(link.url);
        if (fetchOutcome.status !== "OK") {
          result.failed += 1;
          await this.prisma.marketPriceSnapshot.create({
            data: { linkId: link.id, status: fetchOutcome.status, error: fetchOutcome.error },
          });
          continue;
        }
        const parsed = fetchOutcome;

        result.succeeded += 1;
        const snapshot = await this.prisma.marketPriceSnapshot.create({
          data: { linkId: link.id, status: "OK", price: parsed.price, currency: parsed.currency },
        });

        const outcome = await this.propose(link.variantId, snapshot.id, parsed.price, config);
        result[outcome] += 1;
      }

      if (!variantId) {
        const now = new Date();
        await this.prisma.marketSyncConfig.update({
          where: { id: CONFIG_ID },
          data: { lastRunAt: now, nextRunAt: addDays(now, config.cadenceDays) },
        });
      }
      this.logger.log(
        `Sync done: ${result.succeeded}/${result.fetched} fetched, ${result.autoApplied} auto-applied, ${result.pendingReview} pending review`,
      );
      return result;
    } finally {
      this.running = false;
    }
  }

  /**
   * Fetch + parse one linked listing's price, dispatching on the marketplace:
   * Shopify stores (Gazelle, plug.tech) → public product JSON, fetched directly;
   * Back Market → HTML page, via the scraping proxy.
   */
  private async fetchPrice(
    url: string,
  ): Promise<
    | { status: "OK"; price: number; currency: string }
    | { status: "FETCH_ERROR" | "PARSE_ERROR"; error: string }
  > {
    const shopify = shopifySourceForUrl(url);
    if (shopify) {
      const req = toShopifyProductRequest(url);
      if (!req) return { status: "PARSE_ERROR", error: "Not a product URL (…/products/<name>)" };
      const fetched = await this.fetcher.fetchPage(req.jsonUrl, { direct: true });
      if (!fetched.ok) return { status: "FETCH_ERROR", error: fetched.error };
      let json: unknown;
      try {
        json = JSON.parse(fetched.html);
      } catch {
        return { status: "PARSE_ERROR", error: "Product endpoint did not return JSON" };
      }
      const parsed = parseShopifyProduct(json, req.variantId);
      if (!parsed) {
        return {
          status: "PARSE_ERROR",
          error: req.variantId
            ? `Variant ${req.variantId} not found on the product`
            : "No priced variants on the product",
        };
      }
      return { status: "OK", price: parsed.price, currency: parsed.currency };
    }

    const fetched = await this.fetcher.fetchPage(url);
    if (!fetched.ok) return { status: "FETCH_ERROR", error: fetched.error };
    const parsed = parseBackmarketPrice(fetched.html);
    if (!parsed) return { status: "PARSE_ERROR", error: "No price found in page" };
    return { status: "OK", price: parsed.price, currency: parsed.currency };
  }

  /**
   * Review gate. Small moves auto-apply; big moves and first-ever prices wait for
   * an admin decision so one broken scrape can't silently re-price the catalog.
   */
  private async propose(
    variantId: string,
    snapshotId: string,
    newBase: number,
    config: { autoApplyPct: number; floorPct: number; ceilingPct: number },
  ): Promise<"autoApplied" | "pendingReview" | "unchanged"> {
    const current = await this.prisma.priceBase.findFirst({
      where: { variantId, expiresAt: null },
      orderBy: { effectiveAt: "desc" },
    });
    const oldBase = current?.baseValue ?? null;
    if (oldBase !== null && Math.abs(newBase - oldBase) < MIN_MEANINGFUL_MOVE) return "unchanged";

    const changePct = oldBase !== null ? (newBase - oldBase) / oldBase : null;
    const newFloor = Math.round(newBase * config.floorPct);
    const newCeiling = Math.round(newBase * config.ceilingPct);
    const autoApply = changePct !== null && Math.abs(changePct) <= config.autoApplyPct;

    const proposal = await this.prisma.priceProposal.create({
      data: {
        snapshotId,
        variantId,
        oldBase,
        newBase,
        newFloor,
        newCeiling,
        changePct,
        status: autoApply ? "AUTO_APPLIED" : "PENDING",
        ...(autoApply ? { decidedBy: "auto", decidedAt: new Date() } : {}),
      },
    });
    if (autoApply) {
      await this.applyPriceBase(variantId, proposal.newBase, proposal.newFloor, proposal.newCeiling);
      return "autoApplied";
    }
    return "pendingReview";
  }

  /** Versioned write, same shape as the pricing console: expire current row, insert new. */
  private async applyPriceBase(variantId: string, baseValue: number, floor: number, ceiling: number) {
    const current = await this.prisma.priceBase.findFirst({
      where: { variantId, expiresAt: null },
      orderBy: { effectiveAt: "desc" },
    });
    await this.prisma.$transaction([
      ...(current
        ? [this.prisma.priceBase.update({ where: { id: current.id }, data: { expiresAt: new Date() } })]
        : []),
      this.prisma.priceBase.create({ data: { variantId, baseValue, floor, ceiling } }),
    ]);
  }

  /* ------------------------------ proposals ------------------------------ */

  async decideProposal(id: string, decision: "APPROVE" | "REJECT", decidedBy: string) {
    const proposal = await this.prisma.priceProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException("Proposal not found");
    if (proposal.status !== "PENDING") throw new BadRequestException("Proposal already decided");

    if (decision === "APPROVE") {
      await this.applyPriceBase(proposal.variantId, proposal.newBase, proposal.newFloor, proposal.newCeiling);
    }
    await this.prisma.priceProposal.update({
      where: { id },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        decidedBy,
        decidedAt: new Date(),
      },
    });
    return { ok: true };
  }

  /* ------------------------------ overview ------------------------------ */

  async overview(): Promise<MarketOverviewDto> {
    const [config, variants, links, pending] = await Promise.all([
      this.getConfigRow(),
      this.prisma.variant.findMany({
        include: {
          model: { include: { brand: true, category: true } },
          priceBases: { where: { expiresAt: null }, orderBy: { effectiveAt: "desc" }, take: 1 },
        },
        orderBy: [{ model: { name: "asc" } }, { label: "asc" }],
      }),
      this.prisma.externalProductLink.findMany({
        include: { snapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } },
      }),
      this.prisma.priceProposal.findMany({
        where: { status: "PENDING" },
        include: { snapshot: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const linkByVariant = new Map(links.map((l) => [l.variantId, l]));
    const pendingVariants = new Set(pending.map((p) => p.variantId));
    const variantById = new Map(variants.map((v) => [v.id, v]));

    return {
      config: toConfigDto(config),
      rows: variants.map((v) => {
        const link = linkByVariant.get(v.id);
        return {
          variantId: v.id,
          variantLabel: v.label,
          modelId: v.modelId,
          modelName: v.model.name,
          modelSlug: v.model.slug,
          brand: v.model.brand.name,
          categoryName: v.model.category.name,
          baseValue: v.priceBases[0]?.baseValue ?? null,
          link: link
            ? { url: link.url, active: link.active, source: link.source as MarketSource }
            : null,
          lastSnapshot: link?.snapshots[0] ? toSnapshotDto(link.snapshots[0]) : null,
          hasPendingProposal: pendingVariants.has(v.id),
        };
      }),
      pending: pending.map((p) => {
        const v = variantById.get(p.variantId);
        return toProposalDto(p, v?.model.name ?? "?", v?.label ?? "?", p.snapshot?.price ?? null);
      }),
    };
  }
}

/* ------------------------------ mappers ------------------------------ */

function toConfigDto(c: {
  enabled: boolean;
  cadenceDays: number;
  autoApplyPct: number;
  floorPct: number;
  ceilingPct: number;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}): MarketSyncConfigDto {
  return {
    enabled: c.enabled,
    cadenceDays: c.cadenceDays,
    autoApplyPct: c.autoApplyPct,
    floorPct: c.floorPct,
    ceilingPct: c.ceilingPct,
    lastRunAt: c.lastRunAt?.toISOString() ?? null,
    nextRunAt: c.nextRunAt?.toISOString() ?? null,
  };
}

function toSnapshotDto(s: any): MarketSnapshotDto {
  return {
    id: s.id,
    price: s.price,
    currency: s.currency,
    status: s.status,
    error: s.error,
    fetchedAt: s.fetchedAt.toISOString(),
  };
}

function toProposalDto(p: any, modelName: string, variantLabel: string, sourcePrice: number | null): PriceProposalDto {
  return {
    id: p.id,
    variantId: p.variantId,
    modelName,
    variantLabel,
    sourcePrice,
    oldBase: p.oldBase,
    newBase: p.newBase,
    newFloor: p.newFloor,
    newCeiling: p.newCeiling,
    changePct: p.changePct,
    status: p.status,
    decidedBy: p.decidedBy,
    decidedAt: p.decidedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

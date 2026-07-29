/**
 * Pure parsers for Shopify-powered marketplaces (Gazelle, plug.tech). These stores
 * publish public JSON endpoints, so no HTML scraping or proxy is needed:
 *
 *   /products/<handle>.json     — one product, all variants with prices
 *   /search/suggest.json?q=…    — typeahead search, used for link suggestions
 *
 * A product URL may carry Shopify's `?variant=<id>` param (added when a specific
 * config is picked on the site). When present we price that exact variant —
 * letting the admin pin e.g. "Black / Good". Without it we take the cheapest
 * variant, which for refurb stores is the lowest condition tier: a conservative
 * base for a buyback price.
 */

export interface ShopifySourceDef {
  source: string;
  host: string;
}

/** Supported Shopify marketplaces, keyed by hostname. */
export const SHOPIFY_SOURCES: ShopifySourceDef[] = [
  { source: "GAZELLE", host: "buy.gazelle.com" },
  { source: "PLUG", host: "plug.tech" },
];

export function shopifySourceForUrl(url: string): ShopifySourceDef | null {
  const host = hostOf(url);
  if (!host) return null;
  return SHOPIFY_SOURCES.find((s) => host === s.host || host.endsWith(`.${s.host}`)) ?? null;
}

/** "https://buy.gazelle.com/products/iphone-11?variant=123&_pos=1" → json URL + variant id. */
export function toShopifyProductRequest(
  url: string,
): { jsonUrl: string; variantId: string | null } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const m = parsed.pathname.match(/^(.*\/products\/[^/]+?)(?:\.json)?\/?$/);
  if (!m) return null;
  return {
    jsonUrl: `${parsed.origin}${m[1]}.json`,
    variantId: parsed.searchParams.get("variant"),
  };
}

export interface ShopifyPrice {
  price: number;
  currency: string;
  /** e.g. "Black / Good" — recorded so the admin can see which config was priced. */
  variantTitle: string;
  /**
   * Price per condition tier, e.g. { fair: 152.99, good: 167.99, excellent: 179.99 }.
   * Scoped to the pinned variant's color when a ?variant= id is given; otherwise the
   * cheapest price per tier across all colors.
   */
  tierPrices: Record<string, number>;
}

/** Condition keywords marketplaces use in variant titles ("Black / 64GB / Good"). */
const TIER_KEYWORDS = ["fair", "good", "great", "excellent", "premium"] as const;

export function parseShopifyProduct(json: unknown, variantId: string | null): ShopifyPrice | null {
  if (!json || typeof json !== "object") return null;
  const product = (json as Record<string, unknown>).product;
  if (!product || typeof product !== "object") return null;
  const variants = (product as Record<string, unknown>).variants;
  if (!Array.isArray(variants) || variants.length === 0) return null;

  const usable = variants
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const obj = v as Record<string, unknown>;
      const price = toNumber(obj.price);
      if (price === null) return null;
      const title = String(obj.title ?? "");
      return { id: String(obj.id ?? ""), title, price, ...splitTier(title) };
    })
    .filter(
      (v): v is { id: string; title: string; price: number; tier: string | null; rest: string } =>
        v !== null,
    );
  if (usable.length === 0) return null;

  const chosen = variantId
    ? usable.find((v) => v.id === variantId)
    : usable.reduce((min, v) => (v.price < min.price ? v : min));
  if (!chosen) return null; // pinned variant no longer exists → surface as parse error

  // Tier map: when pinned, stay within the pinned variant's color/config ("rest");
  // otherwise take the cheapest per tier across the whole product.
  const pool = variantId ? usable.filter((v) => v.rest === chosen.rest) : usable;
  const tierPrices: Record<string, number> = {};
  for (const v of pool) {
    if (!v.tier) continue;
    if (tierPrices[v.tier] === undefined || v.price < tierPrices[v.tier]) {
      tierPrices[v.tier] = v.price;
    }
  }

  return { price: chosen.price, currency: "USD", variantTitle: chosen.title, tierPrices };
}

/** "Black / 64GB / Good" → { tier: "good", rest: "black / 64gb" }. */
function splitTier(title: string): { tier: string | null; rest: string } {
  const parts = title.split("/").map((p) => p.trim().toLowerCase());
  const tierIdx = parts.findIndex((p) => (TIER_KEYWORDS as readonly string[]).includes(p));
  if (tierIdx === -1) return { tier: null, rest: parts.join(" / ") };
  return { tier: parts[tierIdx], rest: parts.filter((_, i) => i !== tierIdx).join(" / ") };
}

export interface ShopifySuggestCandidate {
  url: string;
  title: string;
}

export function parseShopifySuggest(json: unknown, baseUrl: string): ShopifySuggestCandidate[] {
  if (!json || typeof json !== "object") return [];
  const products = (json as any)?.resources?.results?.products;
  if (!Array.isArray(products)) return [];
  const out: ShopifySuggestCandidate[] = [];
  for (const p of products) {
    if (!p || typeof p !== "object") continue;
    const url = typeof p.url === "string" ? p.url : null;
    const title = typeof p.title === "string" ? p.title : "";
    if (!url || !title) continue;
    // Strip the search-tracking params (_pos/_psq/…) — keep a clean product URL.
    const path = url.split(/[?#]/)[0];
    out.push({ url: path.startsWith("http") ? path : `${baseUrl.replace(/\/$/, "")}${path}`, title });
  }
  return out;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Pure HTML → price parser for Back Market product pages. No I/O — takes the raw
 * page markup so it is trivially testable against saved fixtures when Back Market
 * changes their frontend.
 *
 * Extraction strategy, most → least reliable:
 *   1. JSON-LD (`application/ld+json`) Product offers — schema.org data BM ships for SEO.
 *   2. OpenGraph / itemprop price meta tags.
 *   3. A `"price"` field inside the embedded Next.js state blob.
 */

export interface ParsedPrice {
  price: number;
  currency: string;
}

export function parseBackmarketPrice(html: string): ParsedPrice | null {
  return fromJsonLd(html) ?? fromMetaTags(html) ?? fromStateBlob(html);
}

/* ---- 1. JSON-LD Product schema ---- */

function fromJsonLd(html: string): ParsedPrice | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of scripts) {
    let doc: unknown;
    try {
      doc = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const product = findProduct(doc);
    if (!product) continue;
    const parsed = fromOffers((product as Record<string, unknown>).offers);
    if (parsed) return parsed;
  }
  return null;
}

/** Walk a JSON-LD document (object, array, or @graph) looking for a Product node. */
function findProduct(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Product")) return obj;
  if (obj["@graph"]) return findProduct(obj["@graph"]);
  return null;
}

function fromOffers(offers: unknown): ParsedPrice | null {
  if (!offers) return null;
  const list = Array.isArray(offers) ? offers : [offers];
  for (const offer of list) {
    if (!offer || typeof offer !== "object") continue;
    const o = offer as Record<string, unknown>;
    // AggregateOffer carries lowPrice; a plain Offer carries price.
    const raw = o.lowPrice ?? o.price;
    const price = toNumber(raw);
    if (price !== null) {
      return { price, currency: typeof o.priceCurrency === "string" ? o.priceCurrency : "USD" };
    }
    // AggregateOffer can also nest its offers.
    const nested = fromOffers(o.offers);
    if (nested) return nested;
  }
  return null;
}

/* ---- 2. Meta tags ---- */

function fromMetaTags(html: string): ParsedPrice | null {
  const priceMatch =
    html.match(/<meta[^>]*(?:property|name)=["']og:price:amount["'][^>]*content=["']([\d.,]+)["']/i) ??
    html.match(/<meta[^>]*itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i);
  if (!priceMatch) return null;
  const price = toNumber(priceMatch[1]);
  if (price === null) return null;
  const currencyMatch =
    html.match(/<meta[^>]*(?:property|name)=["']og:price:currency["'][^>]*content=["'](\w{3})["']/i) ??
    html.match(/<meta[^>]*itemprop=["']priceCurrency["'][^>]*content=["'](\w{3})["']/i);
  return { price, currency: currencyMatch?.[1] ?? "USD" };
}

/* ---- 3. Embedded state blob (last resort) ---- */

function fromStateBlob(html: string): ParsedPrice | null {
  // BM's Nuxt/Next state carries entries like "price":{"amount":"110.00","currency":"USD"}.
  const structured = html.match(
    /"price"\s*:\s*\{\s*"amount"\s*:\s*"?([\d.]+)"?\s*,\s*"currency"\s*:\s*"(\w{3})"/,
  );
  if (structured) {
    const price = toNumber(structured[1]);
    if (price !== null) return { price, currency: structured[2] };
  }
  const flat = html.match(/"price"\s*:\s*"?([\d.]+)"?/);
  if (flat) {
    const price = toNumber(flat[1]);
    if (price !== null) return { price, currency: "USD" };
  }
  return null;
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

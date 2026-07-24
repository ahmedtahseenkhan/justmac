/**
 * Pure HTML → candidate list parser for Back Market search-result pages. No I/O,
 * same philosophy as backmarket.parser.ts: testable against saved fixtures.
 *
 * Extraction strategy, most → least reliable:
 *   1. JSON-LD ItemList (schema.org search-results markup).
 *   2. Anchor tags pointing at product pages (`/<locale>/p/<slug>/<uuid>`).
 */

export interface SearchCandidate {
  url: string;
  title: string;
}

const PRODUCT_PATH = /^\/[a-z]{2}(?:-[a-z]{2})?\/p\//i;

export function parseBackmarketSearch(html: string, baseUrl: string): SearchCandidate[] {
  const candidates = [...fromItemList(html, baseUrl), ...fromAnchors(html, baseUrl)];
  // Dedupe by canonical URL (path without query/hash), keep first (best-source) title.
  const seen = new Map<string, SearchCandidate>();
  for (const c of candidates) {
    const key = c.url.split(/[?#]/)[0];
    if (!seen.has(key) && c.title) seen.set(key, { ...c, url: key });
  }
  return [...seen.values()];
}

/* ---- 1. JSON-LD ItemList ---- */

function fromItemList(html: string, baseUrl: string): SearchCandidate[] {
  const out: SearchCandidate[] = [];
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
    collectListItems(doc, out, baseUrl);
  }
  return out;
}

function collectListItems(node: unknown, out: SearchCandidate[], baseUrl: string): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectListItems(item, out, baseUrl);
    return;
  }
  const obj = node as Record<string, unknown>;
  const elements = obj.itemListElement;
  if (Array.isArray(elements)) {
    for (const el of elements) {
      if (!el || typeof el !== "object") continue;
      const e = el as Record<string, unknown>;
      const item = (e.item && typeof e.item === "object" ? e.item : e) as Record<string, unknown>;
      const url = typeof item.url === "string" ? item.url : typeof e.url === "string" ? e.url : null;
      const title = typeof item.name === "string" ? item.name : typeof e.name === "string" ? e.name : "";
      if (url) out.push({ url: absolutize(url, baseUrl), title });
    }
  }
  if (obj["@graph"]) collectListItems(obj["@graph"], out, baseUrl);
}

/* ---- 2. Product anchors ---- */

function fromAnchors(html: string, baseUrl: string): SearchCandidate[] {
  const out: SearchCandidate[] = [];
  const anchors = html.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const m of anchors) {
    const href = m[2];
    const path = href.replace(/^https?:\/\/[^/]+/i, "");
    if (!PRODUCT_PATH.test(path)) continue;
    // Prefer an aria-label/title attribute; fall back to the anchor's visible text.
    const attrs = `${m[1]} ${m[3]}`;
    const label =
      attrs.match(/aria-label=["']([^"']+)["']/i)?.[1] ??
      attrs.match(/title=["']([^"']+)["']/i)?.[1] ??
      stripTags(m[4]);
    out.push({ url: absolutize(href, baseUrl), title: decodeEntities(label).trim() });
  }
  return out;
}

/* ---- helpers ---- */

function absolutize(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/* ---- ranking ---- */

/**
 * Score a candidate title against the variant's search tokens (brand, model,
 * storage, color…). 1.0 = every token present. "64 GB" and "64GB" are normalized
 * to the same token so storage sizes match reliably.
 */
export function scoreCandidate(title: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const haystack = normalize(title);
  const hits = tokens.filter((t) => haystack.includes(t)).length;
  if (hits === 0) return 0;
  // Light penalty for words the query didn't ask for, so "iPhone 11 64GB" outranks
  // "iPhone 11 Pro Max 64GB" when the query is just "iPhone 11 64GB".
  const extras = Math.max(0, haystack.split(" ").length - hits);
  return (hits / tokens.length) * (1 / (1 + 0.05 * extras));
}

export function toSearchTokens(...parts: string[]): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    for (const t of normalize(part).split(" ")) {
      if (t.length >= 2) tokens.add(t);
    }
  }
  return [...tokens];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/(\d+)\s+(gb|tb)\b/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

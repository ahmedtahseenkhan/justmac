"use client";

// Products — every catalog variant and its marketplace match, searchable and filterable.

import { useEffect, useMemo, useState } from "react";
import type { MarketLinkSuggestionsDto, MarketVariantRow } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { SourceBadge, TierChips, useMarketOverview } from "../shared";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs-check", label: "Needs check" },
  { key: "unmatched", label: "Unmatched" },
  { key: "verified", label: "Verified" },
  { key: "errors", label: "Fetch errors" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const MODELS_PER_PAGE = 10;

function matchesFilter(r: MarketVariantRow, f: FilterKey): boolean {
  switch (f) {
    case "needs-check":
      return !!r.link && !r.link.verified;
    case "unmatched":
      return !r.link;
    case "verified":
      return !!r.link?.verified;
    case "errors":
      return !!r.lastSnapshot && r.lastSnapshot.status !== "OK";
    default:
      return true;
  }
}

export default function ProductsPage() {
  const { data, error, refresh } = useMarketOverview();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(0);

  // Deep links from the review page's stat tiles: ?filter=needs-check etc.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("filter");
    if (param && FILTERS.some((f) => f.key === param)) setFilter(param as FilterKey);
  }, []);

  const rows = data?.rows ?? [];

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: rows.length, "needs-check": 0, unmatched: 0, verified: 0, errors: 0 };
    for (const r of rows) {
      for (const f of ["needs-check", "unmatched", "verified", "errors"] as const) {
        if (matchesFilter(r, f)) c[f] += 1;
      }
    }
    return c;
  }, [rows]);

  const models = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (!matchesFilter(r, filter)) return false;
      if (!needle) return true;
      const hay = `${r.brand} ${r.modelName} ${r.variantLabel} ${r.link?.matchTitle ?? ""}`.toLowerCase();
      return needle.split(/\s+/).every((t) => hay.includes(t));
    });
    const byModel = new Map<string, MarketVariantRow[]>();
    for (const r of filtered) {
      const list = byModel.get(r.modelId) ?? [];
      list.push(r);
      byModel.set(r.modelId, list);
    }
    return Array.from(byModel.values());
  }, [rows, q, filter]);

  const pageCount = Math.max(1, Math.ceil(models.length / MODELS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = models.slice(safePage * MODELS_PER_PAGE, (safePage + 1) * MODELS_PER_PAGE);

  if (!data) return <p className="text-ink-400">{error ?? "Loading…"}</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600">{error}</p>}

      {/* Toolbar: search + status filters */}
      <div className="sticky top-16 z-10 -mx-1 rounded-xl border border-line bg-white/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-64 flex-none"
            placeholder="Search model, storage, listing…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setPage(0);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === f.key ? "bg-brand-700 text-white" : "bg-gray-100 text-ink-700 hover:bg-gray-200"
                }`}
              >
                {f.label} <span className="opacity-70">({counts[f.key]})</span>
              </button>
            ))}
          </div>
          {pageCount > 1 && (
            <div className="ml-auto flex items-center gap-2 text-sm text-ink-500">
              <button className="btn-ghost px-2 py-1" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                ← Prev
              </button>
              <span>
                {safePage + 1} / {pageCount}
              </span>
              <button
                className="btn-ghost px-2 py-1"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {models.length === 0 ? (
        <div className="card p-8 text-center text-ink-500">
          No products match{q ? ` “${q}”` : ""} with this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((variants) => (
            <div key={variants[0].modelId} className="card p-5">
              <p className="font-semibold">
                {variants[0].brand} {variants[0].modelName}
                <span className="ml-2 text-xs font-normal text-ink-400">{variants[0].categoryName}</span>
              </p>
              <div className="mt-3 space-y-3">
                {variants.map((v) => (
                  <VariantRow key={v.variantId} row={v} onChange={refresh} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Variant row --------------------------- */

function VariantRow({ row, onChange }: { row: MarketVariantRow; onChange: () => void }) {
  const [url, setUrl] = useState(row.link?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MarketLinkSuggestionsDto | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  useEffect(() => setUrl(row.link?.url ?? ""), [row.link?.url]);
  const dirty = url.trim() !== (row.link?.url ?? "");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function findSuggestions() {
    setSuggesting(true);
    setError(null);
    try {
      setSuggestions(await api.marketSuggestLinks(row.variantId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion search failed.");
    } finally {
      setSuggesting(false);
    }
  }

  async function useCandidate(candidateUrl: string) {
    await run(() => api.marketUpsertLink(row.variantId, { url: candidateUrl, active: true }));
    setSuggestions(null);
  }

  const snap = row.lastSnapshot;
  const link = row.link;

  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-40 shrink-0">
          <p className="text-sm font-medium">{row.variantLabel}</p>
          <p className="text-xs text-ink-400">
            base {row.baseValue !== null ? money(row.baseValue) : "—"}
            {row.hasPendingProposal && <span className="ml-1 text-amber-600">· review pending</span>}
          </p>
        </div>

        {link ? (
          <>
            <SourceBadge source={link.source} />
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-xs text-brand-700 underline"
              title={link.matchTitle ?? link.url}
            >
              {link.matchTitle ?? link.url.replace(/^https?:\/\//, "")} ↗
            </a>
            {link.verified ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                ✓ verified
              </span>
            ) : (
              <>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                  auto-matched{link.matchScore !== null ? ` ${Math.round(link.matchScore * 100)}%` : ""}
                </span>
                <button
                  className="btn-primary px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => void run(() => api.marketVerifyLink(row.variantId))}
                >
                  ✓ Correct
                </button>
              </>
            )}
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              disabled={busy}
              onClick={() => void run(() => api.marketRefreshOne(row.variantId))}
            >
              {busy ? "…" : "Fetch now"}
            </button>
            <button
              className="btn-ghost px-3 py-1.5 text-xs text-red-600"
              disabled={busy}
              title="Remove this match — the next sync will search again, or match manually below"
              onClick={() => void run(() => api.marketDeleteLink(row.variantId))}
            >
              {link.verified ? "Unlink" : "✕ Wrong product"}
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-ink-400">Not matched yet — will auto-match on the next sync</span>
            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={suggesting || busy} onClick={findSuggestions}>
              {suggesting ? "Searching…" : "🔎 Find"}
            </button>
            <input
              className="input min-w-52 flex-1"
              placeholder="…or paste a product URL"
              value={url}
              disabled={busy}
              onChange={(e) => setUrl(e.target.value)}
            />
            {dirty && url.trim() && (
              <button
                className="btn-primary px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={() => void run(() => api.marketUpsertLink(row.variantId, { url: url.trim(), active: true }))}
              >
                Save link
              </button>
            )}
          </>
        )}

        {snap && (
          <div className="ml-auto text-right">
            {snap.status === "OK" && snap.price !== null ? (
              snap.tierPrices && Object.keys(snap.tierPrices).length > 0 ? (
                <TierChips tiers={snap.tierPrices} currency={snap.currency} />
              ) : (
                <p className="text-sm font-semibold tabular-nums text-brand-700">{money(snap.price, snap.currency)}</p>
              )
            ) : (
              <p className="text-xs font-medium text-red-600">
                {snap.status === "FETCH_ERROR" ? "Fetch failed" : "Parse failed"}
                {snap.error ? ` — ${snap.error}` : ""}
              </p>
            )}
            <p className="text-[10px] text-ink-400">{new Date(snap.fetchedAt).toLocaleString()}</p>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {suggestions && (
        <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-500">
              Suggestions for <span className="font-medium">“{suggestions.query}”</span> — pick the matching listing:
            </p>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setSuggestions(null)}>
              ✕ Close
            </button>
          </div>
          {suggestions.error ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-red-600">{suggestions.error}</p>
              <div className="rounded-lg bg-white px-3 py-2.5">
                <a
                  href={suggestions.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-brand-700 underline"
                >
                  Open this search on Back Market in your browser ↗
                </a>
                <p className="mt-1 text-xs text-ink-500">
                  Your browser passes Back Market&apos;s bot check even when the server can&apos;t. Find the
                  matching product, copy its URL, and paste it in the field above.
                </p>
              </div>
            </div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {suggestions.candidates.map((c) => (
                <li key={c.url} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.score >= 0.8
                        ? "bg-emerald-100 text-emerald-700"
                        : c.score >= 0.5
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-ink-500"
                    }`}
                  >
                    {Math.round(c.score * 100)}% match
                  </span>
                  <SourceBadge source={c.source} />
                  <span className="min-w-0 flex-1 truncate text-xs" title={c.title}>
                    {c.title}
                  </span>
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-brand-700 underline">
                    View ↗
                  </a>
                  <button className="btn-primary px-3 py-1 text-xs" disabled={busy} onClick={() => void useCandidate(c.url)}>
                    Use this link
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

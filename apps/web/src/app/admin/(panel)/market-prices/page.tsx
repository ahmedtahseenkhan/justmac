"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  MarketLinkSuggestionsDto,
  MarketOverviewDto,
  MarketSource,
  MarketSyncRunResult,
  MarketVariantRow,
  PriceProposalDto,
} from "@sellme/shared";
import { MARKET_SOURCE_LABELS } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function MarketPricesPage() {
  const [data, setData] = useState<MarketOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setData(await api.marketOverview());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  if (!data) {
    return <p className="text-ink-400">{error ?? "Loading…"}</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Market prices</h1>
        <p className="mt-1 text-ink-500">
          Pulls reference prices from Back Market, Gazelle, and plug.tech on a schedule and updates
          each variant&apos;s base value. Condition percentages (flawless / good / …) stay in the{" "}
          <Link href="/admin/catalog" className="text-brand-700 underline">catalog editor</Link> — the
          fetched price only replaces the base the formula starts from.
        </p>
      </div>
      {error && <p className="text-red-600">{error}</p>}

      <ConfigSection data={data} onChange={refresh} />
      {data.pending.length > 0 && <ApprovalsSection pending={data.pending} onDecided={refresh} />}
      <MappingSection rows={data.rows} onChange={refresh} />
    </div>
  );
}

/* --------------------------- Sync config --------------------------- */

function ConfigSection({ data, onChange }: { data: MarketOverviewDto; onChange: () => void }) {
  const c = data.config;
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState<MarketSyncRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const linked = data.rows.filter((r) => r.link?.active).length;

  async function save(patch: Parameters<typeof api.marketUpdateConfig>[0]) {
    setBusy(true);
    try {
      await api.marketUpdateConfig(patch);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    setRunError(null);
    setRunResult(null);
    try {
      setRunResult(await api.marketRunSync());
      onChange();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Sync schedule</h2>
          <p className="text-sm text-ink-500">
            {linked} variant{linked === 1 ? "" : "s"} linked · last run{" "}
            {c.lastRunAt ? new Date(c.lastRunAt).toLocaleString() : "never"} · next run{" "}
            {c.enabled ? (c.nextRunAt ? new Date(c.nextRunAt).toLocaleString() : "pending schedule") : "paused"}
          </p>
        </div>
        <button className="btn-primary" disabled={busy || linked === 0} onClick={runNow}>
          {busy ? "Working…" : "Run sync now"}
        </button>
      </div>

      {runResult && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Fetched {runResult.fetched} · ok {runResult.succeeded} · failed {runResult.failed} ·
          auto-applied {runResult.autoApplied} · pending review {runResult.pendingReview} · unchanged{" "}
          {runResult.unchanged}
        </p>
      )}
      {runError && <p className="mt-3 text-sm text-red-600">{runError}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-ink-500">
          Automatic sync
          <select
            className="input mt-1"
            value={c.enabled ? "on" : "off"}
            disabled={busy}
            onChange={(e) => void save({ enabled: e.target.value === "on" })}
          >
            <option value="on">Enabled</option>
            <option value="off">Paused</option>
          </select>
        </label>
        <label className="text-xs text-ink-500">
          Cadence
          <select
            className="input mt-1"
            value={String(c.cadenceDays)}
            disabled={busy}
            onChange={(e) => void save({ cadenceDays: Number(e.target.value) })}
          >
            <option value="7">Weekly</option>
            <option value="14">Bi-weekly</option>
            <option value="30">Monthly</option>
          </select>
        </label>
        <PctField
          label="Auto-apply up to ±"
          value={c.autoApplyPct}
          disabled={busy}
          onSave={(v) => void save({ autoApplyPct: v })}
          helper="Bigger moves wait for approval"
        />
        <PctField
          label="Floor (% of base)"
          value={c.floorPct}
          disabled={busy}
          onSave={(v) => void save({ floorPct: v })}
          helper="Never quote below this"
        />
        <PctField
          label="Ceiling (% of base)"
          value={c.ceilingPct}
          disabled={busy}
          onSave={(v) => void save({ ceilingPct: v })}
          helper="Never quote above this"
        />
      </div>
    </section>
  );
}

function PctField({
  label,
  value,
  disabled,
  onSave,
  helper,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onSave: (v: number) => void;
  helper: string;
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 100)));
  useEffect(() => setDraft(String(Math.round(value * 100))), [value]);
  const changed = Number(draft) !== Math.round(value * 100);

  return (
    <label className="text-xs text-ink-500">
      {label}
      <div className="mt-1 flex items-center gap-1">
        <input
          type="number"
          className="input"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
        />
        <span>%</span>
        {changed && (
          <button
            className="btn-ghost px-2 py-1 text-xs"
            disabled={disabled}
            onClick={() => onSave(Number(draft) / 100)}
          >
            Save
          </button>
        )}
      </div>
      <span className="text-[10px] text-ink-400">{helper}</span>
    </label>
  );
}

/* --------------------------- Approvals --------------------------- */

function ApprovalsSection({ pending, onDecided }: { pending: PriceProposalDto[]; onDecided: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusyId(id);
    try {
      await api.marketDecideProposal(id, decision);
      onDecided();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card border-amber-200 bg-amber-50/40 p-6">
      <h2 className="text-lg font-bold">
        Needs review <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800">{pending.length}</span>
      </h2>
      <p className="text-sm text-ink-500">
        First-time prices and moves beyond the auto-apply threshold. Approving updates the
        variant&apos;s base value (and floor/ceiling) immediately.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 pr-4">Device</th>
              <th className="py-2 pr-4 text-right">Back Market</th>
              <th className="py-2 pr-4 text-right">Current base</th>
              <th className="py-2 pr-4 text-right">Proposed base</th>
              <th className="py-2 pr-4 text-right">Change</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-4">
                  <span className="font-medium">{p.modelName}</span>{" "}
                  <span className="text-ink-500">{p.variantLabel}</span>
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.sourcePrice !== null ? money(p.sourcePrice) : "—"}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.oldBase !== null ? money(p.oldBase) : <span className="text-ink-400">first price</span>}
                </td>
                <td className="py-2 pr-4 text-right font-semibold tabular-nums">{money(p.newBase)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.changePct !== null ? (
                    <span className={p.changePct >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {p.changePct >= 0 ? "+" : ""}
                      {Math.round(p.changePct * 100)}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 text-right">
                  <button
                    className="btn-primary px-3 py-1.5 text-xs"
                    disabled={busyId === p.id}
                    onClick={() => void decide(p.id, "APPROVE")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn-ghost ml-2 px-3 py-1.5 text-xs"
                    disabled={busyId === p.id}
                    onClick={() => void decide(p.id, "REJECT")}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --------------------------- Mapping table --------------------------- */

function MappingSection({ rows, onChange }: { rows: MarketVariantRow[]; onChange: () => void }) {
  const models = useMemo(() => {
    const byModel = new Map<string, MarketVariantRow[]>();
    for (const r of rows) {
      const list = byModel.get(r.modelId) ?? [];
      list.push(r);
      byModel.set(r.modelId, list);
    }
    return Array.from(byModel.values());
  }, [rows]);

  return (
    <section>
      <h2 className="text-lg font-bold">Marketplace mapping</h2>
      <p className="text-sm text-ink-500">
        Paste a product URL from Back Market, Gazelle, or plug.tech next to each variant you want
        tracked, or use <em>Find</em> to get suggestions. Only linked variants are fetched — matching
        stays manual on purpose, so a wrong listing never silently re-prices a device. Gazelle and
        plug.tech list per-condition prices: pick the exact condition on their site so the URL carries
        it, or the lowest-priced condition is used.
      </p>
      <div className="mt-4 space-y-4">
        {models.map((variants) => (
          <div key={variants[0].modelId} className="card p-5">
            <p className="font-semibold">
              {variants[0].brand} {variants[0].modelName}
              <span className="ml-2 text-xs font-normal text-ink-400">{variants[0].categoryName}</span>
            </p>
            <div className="mt-3 space-y-3">
              {variants.map((v) => (
                <VariantRow key={v.variantId} row={v} onChange={onChange} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const SOURCE_STYLES: Record<MarketSource, string> = {
  BACKMARKET: "bg-violet-100 text-violet-700",
  GAZELLE: "bg-sky-100 text-sky-700",
  PLUG: "bg-teal-100 text-teal-700",
};

function SourceBadge({ source }: { source: MarketSource }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SOURCE_STYLES[source]}`}>
      {MARKET_SOURCE_LABELS[source]}
    </span>
  );
}

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
        <input
          className="input min-w-64 flex-1"
          placeholder="Product URL on backmarket.com / gazelle.com / plug.tech"
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.target.value)}
        />
        {row.link && <SourceBadge source={row.link.source} />}
        <button className="btn-ghost px-3 py-1.5 text-xs" disabled={suggesting || busy} onClick={findSuggestions}>
          {suggesting ? "Searching…" : "🔎 Find"}
        </button>
        {dirty && url.trim() && (
          <button
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => void run(() => api.marketUpsertLink(row.variantId, { url: url.trim(), active: true }))}
          >
            Save link
          </button>
        )}
        {row.link && (
          <>
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
              onClick={() => void run(() => api.marketDeleteLink(row.variantId))}
            >
              Unlink
            </button>
          </>
        )}
        {snap && (
          <div className="ml-auto text-right">
            {snap.status === "OK" && snap.price !== null ? (
              <p className="text-sm font-semibold tabular-nums text-brand-700">{money(snap.price, snap.currency)}</p>
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
              Suggestions for <span className="font-medium">“{suggestions.query}”</span> — pick the
              matching listing:
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
                  Your browser passes Back Market&apos;s bot check even when the server can&apos;t.
                  Find the matching product, copy its URL, and paste it in the field above.
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
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-700 underline"
                  >
                    View ↗
                  </a>
                  <button
                    className="btn-primary px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => void useCandidate(c.url)}
                  >
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

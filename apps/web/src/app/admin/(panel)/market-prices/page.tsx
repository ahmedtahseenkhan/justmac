"use client";

// Review queue — the staff's daily view: sync status, what needs a decision, quick stats.

import Link from "next/link";
import { useState } from "react";
import type { MarketOverviewDto, MarketSyncRunResult, PriceProposalDto } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { SourceBadge, TierChips, truncate, useMarketOverview } from "./shared";

export default function ReviewQueuePage() {
  const { data, error, refresh } = useMarketOverview();

  if (!data) return <p className="text-ink-400">{error ?? "Loading…"}</p>;

  return (
    <div className="space-y-6">
      {error && <p className="text-red-600">{error}</p>}
      <SyncStatusCard data={data} onChange={refresh} />
      <ApprovalsSection pending={data.pending} onDecided={refresh} />
    </div>
  );
}

/* --------------------------- Sync status + stats --------------------------- */

function SyncStatusCard({ data, onChange }: { data: MarketOverviewDto; onChange: () => void }) {
  const c = data.config;
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState<MarketSyncRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const rows = data.rows;
  const verified = rows.filter((r) => r.link?.verified).length;
  const needsCheck = rows.filter((r) => r.link && !r.link.verified).length;
  const unmatched = rows.filter((r) => !r.link).length;
  const errors = rows.filter((r) => r.lastSnapshot && r.lastSnapshot.status !== "OK").length;

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
          <h2 className="text-lg font-bold">Sync</h2>
          <p className="text-sm text-ink-500">
            {c.enabled ? (
              <>
                every {c.cadenceDays} days · last run{" "}
                {c.lastRunAt ? new Date(c.lastRunAt).toLocaleString() : "never"} · next{" "}
                {c.nextRunAt ? new Date(c.nextRunAt).toLocaleString() : "pending"}
              </>
            ) : (
              <>paused — enable it in <Link href="/admin/market-prices/settings" className="text-brand-700 underline">Settings</Link></>
            )}
          </p>
        </div>
        <button className="btn-primary" disabled={busy} onClick={runNow}>
          {busy ? "Working… (searching marketplaces)" : "Auto-match & sync now"}
        </button>
      </div>

      {runResult && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Newly matched {runResult.autoMatched} · fetched {runResult.fetched} · ok{" "}
          {runResult.succeeded} · failed {runResult.failed} · auto-applied {runResult.autoApplied} ·
          pending review {runResult.pendingReview} · unchanged {runResult.unchanged}
        </p>
      )}
      {runError && <p className="mt-3 text-sm text-red-600">{runError}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatLink label="Verified products" value={verified} href="/admin/market-prices/products?filter=verified" tone="ok" />
        <StatLink label="Matches to check" value={needsCheck} href="/admin/market-prices/products?filter=needs-check" tone={needsCheck ? "warn" : "ok"} />
        <StatLink label="Unmatched" value={unmatched} href="/admin/market-prices/products?filter=unmatched" tone="muted" />
        <StatLink label="Fetch errors" value={errors} href="/admin/market-prices/products?filter=errors" tone={errors ? "bad" : "ok"} />
      </div>
    </section>
  );
}

const STAT_TONES = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-red-50 text-red-700",
  muted: "bg-gray-50 text-ink-700",
} as const;

function StatLink({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <Link href={href} className={`rounded-xl px-4 py-3 transition hover:opacity-80 ${STAT_TONES[tone]}`}>
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </Link>
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

  if (pending.length === 0) {
    return (
      <section className="card p-8 text-center">
        <p className="text-lg font-semibold">Nothing to review 🎉</p>
        <p className="mt-1 text-sm text-ink-500">
          New matches and price changes will appear here after the next sync.
        </p>
      </section>
    );
  }

  return (
    <section className="card border-amber-200 bg-amber-50/40 p-6">
      <h2 className="text-lg font-bold">
        Needs review{" "}
        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800">
          {pending.length}
        </span>
      </h2>
      <p className="text-sm text-ink-500">
        Check the matched listing, then approve — the price (and condition formula) applies
        immediately, and the match is remembered so future small moves apply on their own.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-400">
              <th className="py-2 pr-4">Device</th>
              <th className="py-2 pr-4">Matched listing</th>
              <th className="py-2 pr-4 text-right">Market price</th>
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
                  {p.linkVerified === false && (
                    <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                      new match
                    </span>
                  )}
                </td>
                <td className="max-w-56 py-2 pr-4">
                  {p.source && <SourceBadge source={p.source} />}
                  {p.sourceUrl && (
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 text-xs text-brand-700 underline"
                      title={p.sourceTitle ?? p.sourceUrl}
                    >
                      {p.sourceTitle ? truncate(p.sourceTitle, 40) : "View listing"} ↗
                    </a>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.tierPrices && Object.keys(p.tierPrices).length > 0 ? (
                    <TierChips tiers={p.tierPrices} />
                  ) : p.sourcePrice !== null ? (
                    money(p.sourcePrice)
                  ) : (
                    "—"
                  )}
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

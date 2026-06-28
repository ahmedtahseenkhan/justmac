"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LIFECYCLE_LABELS, type DashboardDto, type LifecycleState } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { FEATURES } from "@/lib/features";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, []);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-ink-500">Operational overview of the trade-in business.</p>
      </div>
      {error && <p className="text-red-600">{error}</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Awaiting action" value={String(data.awaitingAction)} hint="orders to grade or settle" accent href="/admin/operations" />
            <Kpi label="Paid out" value={money(data.paidTotal)} hint={`${data.paidCount} orders`} href="/admin/orders?state=PAID" />
            <Kpi label="Catalogue" value={String(data.modelCount)} hint="device models" href="/admin/catalog" />
            <Kpi label="Affiliate owed" value={money(data.affiliateEarnings)} hint="commissions earned" href="/admin/affiliates" />
            {FEATURES.shop && (
              <>
                <Kpi label="Gross margin" value={money(data.grossMargin)} hint={`${data.marginPct}% on ${data.unitsSold} sold`} accent href="/admin/resale" />
                <Kpi label="Live listings" value={String(data.listingsLive)} hint="on the storefront" href="/admin/resale" />
              </>
            )}
            {FEATURES.business && (
              <Kpi label="B2B batches" value={String(data.b2bBatches)} hint="bulk / ITAD" href="/admin/b2b" />
            )}
          </div>

          <div className="card p-6">
            <h2 className="font-semibold">Orders by status</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.entries(data.ordersByState) as [LifecycleState, number][])
                .filter(([, n]) => n > 0)
                .map(([state, n]) => (
                  <Link
                    key={state}
                    href={`/admin/orders?state=${state}`}
                    className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm hover:border-brand-300"
                  >
                    <span className="text-ink-600">{LIFECYCLE_LABELS[state]}</span>
                    <span className="font-bold tabular-nums">{n}</span>
                  </Link>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, accent, href }: { label: string; value: string; hint: string; accent?: boolean; href: string }) {
  return (
    <Link href={href} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-xs font-medium text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-3xl font-extrabold tracking-tight ${accent ? "text-brand-600" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-400">{hint}</p>
    </Link>
  );
}

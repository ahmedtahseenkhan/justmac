"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LIFECYCLE_LABELS, LIFECYCLE_STATES, type OrderListDto } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function OrdersAdminPage() {
  return (
    <Suspense fallback={<div className="text-ink-400">Loading…</div>}>
      <OrdersAdmin />
    </Suspense>
  );
}

function OrdersAdmin() {
  const params = useSearchParams();
  const [data, setData] = useState<OrderListDto | null>(null);
  const [q, setQ] = useState("");
  const [state, setState] = useState(params.get("state") ?? "");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .listOrders({ q: q || undefined, state: state || undefined, page })
        .then(setData)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
    }, 150);
    return () => clearTimeout(t);
  }, [q, state, page]);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Orders</h1>
        <p className="text-ink-500">Every trade-in, searchable by tracking ID, name or email.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search tracking ID / name / email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select className="input max-w-[200px]" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {LIFECYCLE_STATES.map((s) => (
            <option key={s} value={s}>{LIFECYCLE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-400">
              <th className="p-3 font-medium">Tracking</th>
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 text-right font-medium">Items</th>
              <th className="p-3 text-right font-medium">Total</th>
              <th className="p-3 font-medium">Placed</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.map((o) => (
              <tr key={o.trackingId} className="border-b border-line/60 last:border-0 hover:bg-canvas">
                <td className="p-3">
                  <Link href={`/admin/orders/${o.trackingId}`} className="font-mono font-semibold text-brand-700 hover:underline">
                    {o.trackingId}
                  </Link>
                </td>
                <td className="p-3">
                  <div className="font-medium">{o.fullName}</div>
                  <div className="text-xs text-ink-400">{o.email}</div>
                </td>
                <td className="p-3"><StatusPill state={o.state} /></td>
                <td className="p-3 text-right tabular-nums">{o.itemCount}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{money(o.totalOffer)}</td>
                <td className="p-3 text-ink-500">{o.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
            {data && data.orders.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-ink-400">No orders match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-400">{data.total} orders</span>
          <div className="flex items-center gap-2">
            <button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="text-ink-500">Page {page} / {pageCount}</span>
            <button className="btn-ghost px-3 py-1.5" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ state }: { state: keyof typeof LIFECYCLE_LABELS }) {
  const terminal = state === "PAID";
  const warn = state === "OFFER_ADJUSTED" || state === "REJECTED" || state === "RETURNED";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        terminal ? "bg-brand-100 text-brand-700" : warn ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-ink-700"
      }`}
    >
      {LIFECYCLE_LABELS[state]}
    </span>
  );
}

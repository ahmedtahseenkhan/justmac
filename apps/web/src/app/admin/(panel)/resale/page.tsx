"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GRADES, type Grade, type MarginReport, type RefurbItemDto } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function OpsResalePage() {
  const [queue, setQueue] = useState<RefurbItemDto[] | null>(null);
  const [margins, setMargins] = useState<MarginReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [q, m] = await Promise.all([api.refurbQueue(), api.margins()]);
      setQueue(q);
      setMargins(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Ops — refurbish &amp; resell</h1>
          <p className="mt-1 text-ink-500">List acquired devices and watch the margin.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/operations" className="btn-ghost">Grading queue</Link>
          <button className="btn-ghost" onClick={refresh}>Refresh</button>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {/* Margin dashboard */}
      {margins && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Units sold" value={String(margins.unitsSold)} />
          <Stat label="Revenue" value={money(margins.revenue)} />
          <Stat label="Gross margin" value={money(margins.grossMargin)} accent />
          <Stat label="Margin %" value={`${margins.marginPct}%`} accent />
        </div>
      )}

      {/* Refurb queue */}
      <div>
        <h2 className="text-lg font-bold">Refurb queue ({queue?.length ?? 0})</h2>
        {queue && queue.length === 0 && (
          <p className="card mt-3 p-6 text-ink-500">
            No paid devices waiting. Acquire one via a trade-in (drive an order to PAID in the{" "}
            <Link href="/admin/operations" className="underline">grading queue</Link>).
          </p>
        )}
        <div className="mt-3 space-y-3">
          {queue?.map((item) => (
            <RefurbCard key={item.deviceId} item={item} onListed={refresh} />
          ))}
        </div>
      </div>

      {/* Recently sold */}
      {margins && margins.recent.length > 0 && (
        <div>
          <h2 className="text-lg font-bold">Recently sold</h2>
          <table className="card mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-ink-300">
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 font-medium">Item</th>
                <th className="p-3 text-right font-medium">Paid</th>
                <th className="p-3 text-right font-medium">Sold</th>
                <th className="p-3 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {margins.recent.map((r) => (
                <tr key={r.sku} className="border-b border-gray-50 last:border-0">
                  <td className="p-3 font-mono text-xs">{r.sku}</td>
                  <td className="p-3">{r.title.split(" · ")[0]}</td>
                  <td className="p-3 text-right text-ink-500">{money(r.acquisitionCost)}</td>
                  <td className="p-3 text-right">{money(r.price)}</td>
                  <td className="p-3 text-right font-semibold text-brand-700">{money(r.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-300">{label}</p>
      <p className={`text-2xl font-extrabold ${accent ? "text-brand-600" : ""}`}>{value}</p>
    </div>
  );
}

function RefurbCard({ item, onListed }: { item: RefurbItemDto; onListed: () => void }) {
  const [grade, setGrade] = useState<Grade>("B");
  const [warranty, setWarranty] = useState(12);
  const [price, setPrice] = useState(item.suggestedPrice);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const margin = price - item.acquisitionCost;
  const marginPct = price > 0 ? Math.round((margin / price) * 1000) / 10 : 0;

  async function list() {
    setBusy(true);
    setErr(null);
    try {
      await api.listDevice(item.deviceId, { grade, warrantyMonths: warranty, price, channel: "STOREFRONT" });
      onListed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "List failed.");
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{item.modelName} <span className="text-ink-500">{item.variantLabel}</span></p>
          <p className="text-xs text-ink-300">
            from {item.orderTrackingId} · serial {item.serial ?? "—"} · acquired {money(item.acquisitionCost)}
          </p>
        </div>
        <span className="text-sm text-ink-500">suggested {money(item.suggestedPrice)}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-500">
          Grade
          <select className="input mt-1" value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-500">
          Warranty (mo)
          <input type="number" className="input mt-1 w-24" value={warranty} onChange={(e) => setWarranty(Number(e.target.value))} />
        </label>
        <label className="text-xs text-ink-500">
          Price
          <input type="number" className="input mt-1 w-28" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
        <span className="text-sm text-ink-500">
          margin <span className="font-semibold text-brand-700">{money(margin)}</span> ({marginPct}%)
        </span>
        <button className="btn-primary ml-auto" disabled={busy || price <= 0} onClick={list}>
          List on storefront
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

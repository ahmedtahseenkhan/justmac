"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PriceWatchDto } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function PriceWatchPage() {
  const [watches, setWatches] = useState<PriceWatchDto[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setWatches(await api.listPriceWatches());
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function run() {
    setBusy(true);
    try {
      const r = await api.runPriceWatch();
      setLastRun(`Checked ${r.checked} · ${r.triggered.length} alert(s) fired`);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Price-watch alerts</h1>
          <p className="mt-1 text-ink-500">
            Watchers are notified when a device's quote reaches their target. Create one from any{" "}
            <Link href="/sell" className="underline">quote</Link>.
          </p>
        </div>
        <button className="btn-primary" disabled={busy} onClick={run}>
          {busy ? "Running…" : "Run checks now"}
        </button>
      </div>
      {lastRun && <p className="mt-2 text-sm text-brand-700">{lastRun}</p>}

      {watches.length === 0 ? (
        <p className="card mt-6 p-6 text-ink-500">No active watches. Create one on a quote's offer screen.</p>
      ) : (
        <div className="card mt-6 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-ink-300">
                <th className="p-3 font-medium">Device</th>
                <th className="p-3 font-medium">Watcher</th>
                <th className="p-3 text-right font-medium">Target</th>
                <th className="p-3 text-right font-medium">Current</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {watches.map((w) => (
                <tr key={w.id} className="border-b border-gray-50 last:border-0">
                  <td className="p-3">{w.modelName} <span className="text-ink-300">{w.variantLabel}</span></td>
                  <td className="p-3 text-ink-500">{w.email}</td>
                  <td className="p-3 text-right">{money(w.threshold)}</td>
                  <td className="p-3 text-right">{money(w.lastOffer)}</td>
                  <td className="p-3">
                    {w.triggeredAt ? (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">🔔 Triggered</span>
                    ) : (
                      <span className="text-xs text-ink-400">watching</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

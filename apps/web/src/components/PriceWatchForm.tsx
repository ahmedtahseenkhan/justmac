"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

/** "Notify me if this device's quote rises above $X." */
export function PriceWatchForm({ variantId, currentOffer }: { variantId: string; currentOffer: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [threshold, setThreshold] = useState(Math.round(currentOffer * 1.1));
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    try {
      await api.createPriceWatch(email, variantId, threshold);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the watch.");
    }
  }

  if (done) {
    return (
      <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
        🔔 We'll email {email} if this quote reaches {money(threshold)}.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
        <span>🔔 Watch this price</span>
        <span className="text-ink-300">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-ink-500">Get notified if the offer rises above your target.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input className="input flex-1" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="text-xs text-ink-500">
              Notify above
              <input type="number" className="input mt-1 w-28" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            </label>
            <button className="btn-primary" disabled={!/.+@.+\..+/.test(email)} onClick={save}>
              Watch
            </button>
          </div>
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}

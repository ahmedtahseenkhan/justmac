"use client";

import { useEffect, useState } from "react";
import type { AffiliateDto } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState<AffiliateDto[]>([]);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);

  // create form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ratePct, setRatePct] = useState(5);

  async function refresh() {
    try {
      setAffiliates(await api.listAffiliates());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }
  useEffect(() => {
    setOrigin(window.location.origin);
    void refresh();
  }, []);

  async function create() {
    setError(null);
    try {
      await api.createAffiliate({ code, name, email, ratePct });
      setCode("");
      setName("");
      setEmail("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Affiliates</h1>
      <p className="mt-1 text-ink-500">Tracked referral links earn commission on paid trade-ins.</p>

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-ink-300">
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Partner</th>
              <th className="p-3 text-right font-medium">Rate</th>
              <th className="p-3 text-right font-medium">Clicks</th>
              <th className="p-3 text-right font-medium">Conversions</th>
              <th className="p-3 text-right font-medium">Earnings</th>
              <th className="p-3 font-medium">Referral link</th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.code} className="border-b border-gray-50 last:border-0">
                <td className="p-3 font-mono font-semibold">{a.code}</td>
                <td className="p-3">{a.name}</td>
                <td className="p-3 text-right">{a.ratePct}%</td>
                <td className="p-3 text-right">{a.clicks}</td>
                <td className="p-3 text-right">{a.conversionCount}</td>
                <td className="p-3 text-right font-semibold text-brand-700">{money(a.earnings)}</td>
                <td className="p-3">
                  <code className="rounded bg-gray-100 px-1 text-xs">{origin}/sell?ref={a.code}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="font-semibold">Add affiliate</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input className="input" placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="input" placeholder="Partner name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-ink-500">
            <input type="number" className="input w-20" value={ratePct} onChange={(e) => setRatePct(Number(e.target.value))} />%
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          className="btn-primary mt-3"
          disabled={!code || !name || !/.+@.+\..+/.test(email)}
          onClick={create}
        >
          Create
        </button>
      </div>
    </div>
  );
}

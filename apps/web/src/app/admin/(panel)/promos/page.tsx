"use client";

import { useEffect, useState } from "react";
import { PROMO_KINDS, type PromoDto, type PromoKind } from "@sellme/shared";
import { api } from "@/lib/api";
import { RequireRole } from "@/components/admin/RequireRole";

export default function PromosPage() {
  return (
    <RequireRole role="ADMIN">
      <Promos />
    </RequireRole>
  );
}

function Promos() {
  const [promos, setPromos] = useState<PromoDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<PromoKind>("BUYBACK_BONUS");
  const [valueType, setValueType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("5");
  const [scope, setScope] = useState("ALL");

  async function refresh() {
    try {
      setPromos(await api.listPromos());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function save() {
    setError(null);
    try {
      await api.upsertPromo({ code, kind, valueType, value: Number(value), scope, active: true });
      setCode("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^API \d+ on \S+ /, "") : "Save failed.");
    }
  }
  async function remove(id: string) {
    await api.deletePromo(id);
    refresh();
  }
  async function toggle(p: PromoDto) {
    await api.upsertPromo({ code: p.code, kind: p.kind, valueType: p.valueType, value: p.value, scope: p.scope, active: !p.active });
    refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Promo codes</h1>
        <p className="text-ink-500">Buyback bonuses and storefront discounts.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-400">
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Value</th>
              <th className="p-3 font-medium">Scope</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="p-3 font-mono font-semibold">{p.code}</td>
                <td className="p-3">{p.kind === "BUYBACK_BONUS" ? "Buyback bonus" : "Resale discount"}</td>
                <td className="p-3">{p.valueType === "PERCENT" ? `${p.value}%` : `$${p.value}`}</td>
                <td className="p-3 text-ink-500">{p.scope}</td>
                <td className="p-3">
                  <button onClick={() => toggle(p)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.active ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-ink-400"}`}>
                    {p.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(p.id)} className="text-xs font-semibold text-ink-400 hover:text-red-600">Delete</button>
                </td>
              </tr>
            ))}
            {promos.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-ink-400">No promos.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">Add / update code</h2>
        <p className="text-xs text-ink-400">Scope: <code className="rounded bg-canvas px-1">ALL</code> or <code className="rounded bg-canvas px-1">category:phones</code>.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <input className="input" placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as PromoKind)}>
            {PROMO_KINDS.map((k) => <option key={k} value={k}>{k === "BUYBACK_BONUS" ? "Buyback bonus" : "Resale discount"}</option>)}
          </select>
          <select className="input" value={valueType} onChange={(e) => setValueType(e.target.value as "PERCENT" | "FIXED")}>
            <option value="PERCENT">Percent</option>
            <option value="FIXED">Fixed $</option>
          </select>
          <input className="input" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          <input className="input" value={scope} onChange={(e) => setScope(e.target.value)} />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-3" disabled={!code} onClick={save}>Save code</button>
      </div>
    </div>
  );
}

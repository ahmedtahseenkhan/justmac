"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CatalogModelRow } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { RequireRole } from "@/components/admin/RequireRole";

export default function CatalogPage() {
  return (
    <RequireRole role="ADMIN">
      <CatalogManager />
    </RequireRole>
  );
}

function CatalogManager() {
  const [rows, setRows] = useState<CatalogModelRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try {
      setRows(await api.catalogAdminModels());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setBusy(id);
    setError(null);
    try {
      await api.deleteModel(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^API \d+ on \S+ /, "") : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Catalog</h1>
          <p className="text-ink-500">Add devices, their configurations, condition trees and prices.</p>
        </div>
        <Link href="/admin/catalog/new" className="btn-primary">+ Add device</Link>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-400">
              <th className="p-3 font-medium">Model</th>
              <th className="p-3 font-medium">Brand</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 text-right font-medium">Variants</th>
              <th className="p-3 text-right font-medium">Cash up to</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-line/60 last:border-0 hover:bg-canvas">
                <td className="p-3 font-medium">{m.name}</td>
                <td className="p-3 text-ink-600">{m.brand}</td>
                <td className="p-3 text-ink-600">{m.category}</td>
                <td className="p-3 text-right tabular-nums">{m.variantCount}</td>
                <td className="p-3 text-right font-semibold tabular-nums text-brand-600">{money(m.cashUpTo)}</td>
                <td className="p-3 text-right">
                  <Link href={`/admin/catalog/${m.id}/edit`} className="text-xs font-semibold text-brand-700 hover:underline">
                    Edit
                  </Link>
                  <button onClick={() => remove(m.id, m.name)} disabled={busy === m.id} className="ml-3 text-xs font-semibold text-ink-400 hover:text-red-600">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-ink-400">No devices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

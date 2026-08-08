"use client";

// Settings — sync schedule, guardrails, and the condition formula.

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConditionRule } from "@sellme/shared";
import { RULE_TIERS } from "@sellme/shared";
import { api } from "@/lib/api";
import { useMarketOverview } from "../shared";

export default function SettingsPage() {
  const { data, error, refresh } = useMarketOverview();
  const [busy, setBusy] = useState(false);

  if (!data) return <p className="text-ink-400">{error ?? "Loading…"}</p>;
  const c = data.config;

  async function save(patch: Parameters<typeof api.marketUpdateConfig>[0]) {
    setBusy(true);
    try {
      await api.marketUpdateConfig(patch);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-red-600">{error}</p>}

      <section className="card p-6">
        <h2 className="text-lg font-bold">Schedule & guardrails</h2>
        <p className="text-sm text-ink-500">
          How often prices are pulled, and how far they can move before staff approval is required.
        </p>
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
            helper="Keep low — it applies to damaged too"
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

      <section className="card p-6">
        <FormulaEditor rules={c.conditionRules} disabled={busy} onSave={(r) => void save({ conditionRules: r })} />
      </section>

      <p className="text-xs text-ink-400">
        Condition percentages become live quote multipliers when a product&apos;s price is approved.
        Category margin and market-demand factors still apply on top — manage those in the{" "}
        <Link href="/admin/pricing" className="text-brand-700 underline">Pricing console</Link>.
      </p>
    </div>
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
          <button className="btn-ghost px-2 py-1 text-xs" disabled={disabled} onClick={() => onSave(Number(draft) / 100)}>
            Save
          </button>
        )}
      </div>
      <span className="text-[10px] text-ink-400">{helper}</span>
    </label>
  );
}

function FormulaEditor({
  rules,
  disabled,
  onSave,
}: {
  rules: ConditionRule[];
  disabled: boolean;
  onSave: (rules: ConditionRule[]) => void;
}) {
  const [draft, setDraft] = useState<ConditionRule[]>(rules);
  useEffect(() => setDraft(rules), [rules]);
  const changed = JSON.stringify(draft) !== JSON.stringify(rules);

  function patch(i: number, p: Partial<ConditionRule>) {
    setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...p } : r)));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Condition formula</h2>
          <p className="text-sm text-ink-500">
            What each cosmetic condition pays, as a percentage of the marketplace price for a tier.
            Applied to a device when its price is approved (or auto-applies after verification).
          </p>
        </div>
        {changed && (
          <button className="btn-primary px-3 py-1.5 text-xs" disabled={disabled} onClick={() => onSave(draft)}>
            Save formula
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {draft.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
            <span className="w-20 font-medium capitalize">{r.key}</span>
            <span className="text-ink-400">=</span>
            <input
              type="number"
              className="input w-16 px-2 py-1 text-right"
              value={r.pct}
              min={0}
              max={100}
              disabled={disabled}
              onChange={(e) => patch(i, { pct: Number(e.target.value) })}
            />
            <span className="text-ink-400">% of</span>
            <select
              className="input flex-1 px-2 py-1"
              value={r.tier}
              disabled={disabled}
              onChange={(e) => patch(i, { tier: e.target.value as ConditionRule["tier"] })}
            >
              {RULE_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t === "lowest" ? "cheapest tier" : `${t} price`}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-400">
        Tiers come from the marketplace listing (e.g. Gazelle sells Fair / Good / Excellent). If a
        listing doesn&apos;t have the chosen tier, the cheapest available tier is used.
      </p>
    </div>
  );
}

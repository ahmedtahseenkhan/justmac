"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AdminCategoryDto,
  AdminModelDto,
  AdminVariantDto,
  BulkPriceResult,
  ConditionAttributeDto,
  SimulateResponse,
} from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function AdminPricingPage() {
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [models, setModels] = useState<AdminModelDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [c, m] = await Promise.all([api.adminCategories(), api.adminModels()]);
      setCategories(c);
      setModels(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Pricing console</h1>
        <p className="mt-1 text-ink-500">
          The core IP — base values, margins, floors/ceilings, and live market feeds. Changes take
          effect immediately (public quotes refresh within the 60s cache window).
        </p>
      </div>
      {error && <p className="text-red-600">{error}</p>}

      <Simulator models={models} />
      <MarginSection categories={categories} onChange={setCategories} />
      <ModelsSection models={models} onChange={refresh} />
      <BulkSection onApplied={refresh} />
    </div>
  );
}

/* --------------------------- Simulator --------------------------- */

function Simulator({ models }: { models: AdminModelDto[] }) {
  const [modelSlug, setModelSlug] = useState("");
  const [variantId, setVariantId] = useState("");
  const [attrs, setAttrs] = useState<ConditionAttributeDto[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const model = useMemo(() => models.find((m) => m.slug === modelSlug), [models, modelSlug]);

  useEffect(() => {
    if (!modelSlug) return;
    setVariantId(model?.variants[0]?.id ?? "");
    api.getModel(modelSlug).then((m) => {
      setAttrs(m.conditionAttributes);
      setGrades(Object.fromEntries(m.conditionAttributes.map((a) => [a.key, a.options[0]?.key])));
      setResult(null);
    });
  }, [modelSlug, model]);

  async function simulate() {
    if (!variantId) return;
    setBusy(true);
    try {
      setResult(
        await api.adminSimulate(
          variantId,
          attrs.map((a) => ({ attributeKey: a.key, optionKey: grades[a.key] })),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-bold">Simulate a quote</h2>
      <p className="text-sm text-ink-500">“What would this exact config pay out right now?”</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-500">
          Model
          <select className="input mt-1" value={modelSlug} onChange={(e) => setModelSlug(e.target.value)}>
            <option value="">Choose a model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.slug}>{m.name}</option>
            ))}
          </select>
        </label>
        {model && (
          <label className="text-xs text-ink-500">
            Variant
            <select className="input mt-1" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              {model.variants.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {attrs.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {attrs.map((a) => (
            <label key={a.key} className="text-xs text-ink-500">
              {a.label}
              <select
                className="input mt-1"
                value={grades[a.key] ?? ""}
                onChange={(e) => setGrades((s) => ({ ...s, [a.key]: e.target.value }))}
              >
                {a.options.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {model && (
        <button className="btn-primary mt-4" disabled={busy || !variantId} onClick={simulate}>
          {busy ? "Simulating…" : "Simulate"}
        </button>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-gray-200 p-4">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-brand-700">{money(result.offer, result.currency)}</span>
            <span className="text-sm text-ink-500">
              band {money(result.confidenceLow)}–{money(result.confidenceHigh)}
            </span>
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {result.breakdown.map((l, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-1 text-ink-500">{l.label}</td>
                  <td className="py-1 text-right tabular-nums text-ink-500">
                    {l.amount >= 0 ? "+" : "−"}{money(Math.abs(l.amount))}
                  </td>
                  <td className="py-1 pl-4 text-right font-medium tabular-nums">{money(l.runningTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* --------------------------- Margins --------------------------- */

function MarginSection({
  categories,
  onChange,
}: {
  categories: AdminCategoryDto[];
  onChange: (c: AdminCategoryDto[]) => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold">Category margins</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <MarginRow key={c.id} cat={c} onSaved={onChange} />
        ))}
      </div>
    </section>
  );
}

function MarginRow({ cat, onSaved }: { cat: AdminCategoryDto; onSaved: (c: AdminCategoryDto[]) => void }) {
  const [pct, setPct] = useState(Math.round(cat.targetMargin * 100));
  const [saved, setSaved] = useState(false);
  const dirty = pct !== Math.round(cat.targetMargin * 100);

  async function save() {
    const next = await api.adminUpdateMargin(cat.id, pct / 100);
    onSaved(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card flex items-center justify-between p-4">
      <div>
        <p className="font-semibold">{cat.name}</p>
        <p className="text-xs text-ink-300">{cat.modelCount} models</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input w-20 text-right"
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
        />
        <span className="text-sm text-ink-500">%</span>
        <button className="btn-primary" disabled={!dirty} onClick={save}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Models & prices --------------------------- */

function ModelsSection({ models, onChange }: { models: AdminModelDto[]; onChange: () => void }) {
  return (
    <section>
      <h2 className="text-lg font-bold">Base values, guardrails &amp; market feeds</h2>
      <div className="mt-3 space-y-4">
        {models.map((m) => (
          <ModelCard key={m.id} model={m} onChange={onChange} />
        ))}
      </div>
    </section>
  );
}

function ModelCard({ model, onChange }: { model: AdminModelDto; onChange: () => void }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{model.name}</p>
          <p className="text-xs text-ink-300">
            {model.categoryName} · margin {Math.round(model.targetMargin * 100)}%
          </p>
        </div>
        <FeedRow model={model} onChange={onChange} />
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-300">
            <th className="pb-1 font-medium">Variant</th>
            <th className="pb-1 text-right font-medium">Base</th>
            <th className="pb-1 text-right font-medium">Floor</th>
            <th className="pb-1 text-right font-medium">Ceiling</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {model.variants.map((v) => (
            <VariantRow key={v.id} variant={v} onSaved={onChange} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedRow({ model, onChange }: { model: AdminModelDto; onChange: () => void }) {
  const [factor, setFactor] = useState(model.marketFactor);
  const [saved, setSaved] = useState(false);
  const dirty = factor !== model.marketFactor;

  async function save() {
    await api.adminUpdateFeed(model.id, factor);
    onChange();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-ink-500">Market feed</span>
      <input
        type="number"
        step="0.01"
        className="input w-24 text-right"
        value={factor}
        onChange={(e) => setFactor(Number(e.target.value))}
      />
      <button className="btn-ghost" disabled={!dirty} onClick={save}>
        {saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}

function VariantRow({ variant, onSaved }: { variant: AdminVariantDto; onSaved: () => void }) {
  const [base, setBase] = useState(variant.baseValue);
  const [floor, setFloor] = useState(variant.floor);
  const [ceiling, setCeiling] = useState(variant.ceiling);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = base !== variant.baseValue || floor !== variant.floor || ceiling !== variant.ceiling;

  async function save() {
    setErr(null);
    try {
      await api.adminUpdateVariantPrice(variant.id, { baseValue: base, floor, ceiling });
      onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <tr className="border-t border-gray-50">
      <td className="py-2">{variant.label}</td>
      <td className="py-2 text-right">
        <input type="number" className="input w-24 text-right" value={base} onChange={(e) => setBase(Number(e.target.value))} />
      </td>
      <td className="py-2 text-right">
        <input type="number" className="input w-20 text-right" value={floor} onChange={(e) => setFloor(Number(e.target.value))} />
      </td>
      <td className="py-2 text-right">
        <input type="number" className="input w-24 text-right" value={ceiling} onChange={(e) => setCeiling(Number(e.target.value))} />
      </td>
      <td className="py-2 pl-3 text-right">
        <button className="btn-primary" disabled={!dirty} onClick={save}>
          {saved ? "✓" : "Save"}
        </button>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </td>
    </tr>
  );
}

/* --------------------------- Bulk upload --------------------------- */

function BulkSection({ onApplied }: { onApplied: () => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkPriceResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function parse() {
    // CSV: modelSlug,variantLabel,baseValue,floor,ceiling  (header row optional)
    const rows = text
      .trim()
      .split("\n")
      .map((line) => line.split(",").map((c) => c.trim()))
      .filter((c) => c.length >= 5 && c[0].toLowerCase() !== "modelslug")
      .map((c) => ({
        modelSlug: c[0],
        variantLabel: c[1],
        baseValue: Number(c[2]),
        floor: Number(c[3]),
        ceiling: Number(c[4]),
      }));
    return rows;
  }

  async function apply() {
    setErr(null);
    setResult(null);
    const rows = parse();
    if (rows.length === 0) {
      setErr("No valid rows. Format: modelSlug,variantLabel,base,floor,ceiling");
      return;
    }
    setBusy(true);
    try {
      const r = await api.adminBulk(rows);
      setResult(r);
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-bold">Bulk price upload</h2>
      <p className="text-sm text-ink-500">
        Paste CSV rows: <code className="rounded bg-gray-100 px-1">modelSlug,variantLabel,base,floor,ceiling</code>
      </p>
      <textarea
        className="input mt-3 h-32 font-mono text-xs"
        placeholder={"iphone-15-pro,256GB,790,140,830\ngalaxy-s23,128GB,360,70,390"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
          }}
        />
        <button className="btn-primary ml-auto" disabled={busy} onClick={apply}>
          {busy ? "Applying…" : "Apply"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {result && (
        <div className="mt-3 text-sm">
          <p className="font-semibold text-brand-700">{result.updated} variant(s) updated.</p>
          {result.errors.length > 0 && (
            <ul className="mt-1 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-red-600">Row {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

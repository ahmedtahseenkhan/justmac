"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONDITION_KINDS, type AdminModelDetail, type CatalogCategoryDto } from "@sellme/shared";
import { api } from "@/lib/api";
import { RequireRole } from "@/components/admin/RequireRole";

export default function EditModelPage({ params }: { params: { id: string } }) {
  return (
    <RequireRole role="ADMIN">
      <EditModel id={params.id} />
    </RequireRole>
  );
}

function cleanErr(e: unknown): string {
  if (!(e instanceof Error)) return "Something went wrong.";
  const m = e.message.match(/"message":"([^"]+)"/);
  return m ? m[1] : e.message.replace(/^API \d+ on \S+ /, "");
}
function attrsToStr(a: Record<string, string>): string {
  return Object.entries(a).map(([k, v]) => `${k}:${v}`).join(", ");
}
function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of s.split(",")) {
    const [k, ...rest] = pair.split(":");
    if (k && rest.length) out[k.trim()] = rest.join(":").trim();
  }
  return out;
}

function EditModel({ id }: { id: string }) {
  const [model, setModel] = useState<AdminModelDetail | null>(null);
  const [cats, setCats] = useState<CatalogCategoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [m, c] = await Promise.all([api.catalogModelDetail(id), api.catalogAdminCategories()]);
      setModel(m);
      setCats(c);
    } catch (e) {
      setError(cleanErr(e));
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!model) return <p className="text-ink-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/catalog" className="text-sm font-semibold text-brand-700 hover:underline">← Catalog</Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">Edit {model.name}</h1>
        <p className="text-ink-500">slug: {model.slug} · changes apply to quotes immediately.</p>
      </div>

      <ModelBasics model={model} cats={cats} onSaved={load} />
      <Variants model={model} onChanged={load} />
      <Conditions model={model} onChanged={load} />
    </div>
  );
}

function SavedFlag({ on }: { on: boolean }) {
  return on ? <span className="ml-2 text-xs font-semibold text-brand-700">Saved ✓</span> : null;
}

/* ---- model basics ---- */
function ModelBasics({ model, cats, onSaved }: { model: AdminModelDetail; cats: CatalogCategoryDto[]; onSaved: () => void }) {
  const [name, setName] = useState(model.name);
  const [imageUrl, setImageUrl] = useState(model.imageUrl ?? "");
  const [categoryId, setCategoryId] = useState(model.categoryId);
  const [brandId, setBrandId] = useState(model.brandId);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const brands = cats.find((c) => c.id === categoryId)?.brands ?? [];

  async function save() {
    setErr(null);
    try {
      await api.updateModel(model.id, { name, imageUrl: imageUrl || null, categoryId, brandId });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    } catch (e) {
      setErr(cleanErr(e));
    }
  }

  return (
    <section className="card space-y-3 p-6">
      <h2 className="font-semibold">Device <SavedFlag on={saved} /></h2>
      <label className="block"><span className="mb-1 block text-sm font-medium text-ink-700">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium text-ink-700">Image URL (optional)</span>
        <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium text-ink-700">Category</span>
          <select className="input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setBrandId(""); }}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-ink-700">Brand</span>
          <select className="input" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Choose…</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary" disabled={!name || !brandId} onClick={save}>Save device</button>
    </section>
  );
}

/* ---- variants ---- */
function Variants({ model, onChanged }: { model: AdminModelDetail; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [na, setNa] = useState({ label: "", attrs: "", baseValue: "", floor: "", ceiling: "" });
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    try {
      await api.addVariant(model.id, {
        label: na.label, attributes: parseAttrs(na.attrs),
        baseValue: Number(na.baseValue), floor: Number(na.floor), ceiling: Number(na.ceiling),
      });
      setNa({ label: "", attrs: "", baseValue: "", floor: "", ceiling: "" });
      setAdding(false);
      onChanged();
    } catch (e) {
      setErr(cleanErr(e));
    }
  }

  return (
    <section className="card space-y-3 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Configurations &amp; prices</h2>
        <button className="btn-ghost text-sm" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add"}</button>
      </div>
      {model.variants.map((v) => <VariantRow key={v.id} v={v} onChanged={onChanged} canDelete={model.variants.length > 1} />)}

      {adding && (
        <div className="rounded-xl border border-dashed border-brand-300 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Label" value={na.label} onChange={(e) => setNa({ ...na, label: e.target.value })} />
            <input className="input" placeholder="storage:256GB, color:Black" value={na.attrs} onChange={(e) => setNa({ ...na, attrs: e.target.value })} />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <input className="input" type="number" placeholder="Base $" value={na.baseValue} onChange={(e) => setNa({ ...na, baseValue: e.target.value })} />
            <input className="input" type="number" placeholder="Floor $" value={na.floor} onChange={(e) => setNa({ ...na, floor: e.target.value })} />
            <input className="input" type="number" placeholder="Ceiling $" value={na.ceiling} onChange={(e) => setNa({ ...na, ceiling: e.target.value })} />
          </div>
          {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
          <button className="btn-primary mt-2" disabled={!na.label} onClick={add}>Add configuration</button>
        </div>
      )}
    </section>
  );
}

function VariantRow({ v, onChanged, canDelete }: { v: AdminModelDetail["variants"][number]; onChanged: () => void; canDelete: boolean }) {
  const [label, setLabel] = useState(v.label);
  const [attrs, setAttrs] = useState(attrsToStr(v.attributes));
  const [base, setBase] = useState(String(v.baseValue));
  const [floor, setFloor] = useState(String(v.floor));
  const [ceiling, setCeiling] = useState(String(v.ceiling));
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    try {
      await api.updateVariant(v.id, { label, attributes: parseAttrs(attrs), baseValue: Number(base), floor: Number(floor), ceiling: Number(ceiling) });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onChanged();
    } catch (e) {
      setErr(cleanErr(e));
    }
  }
  async function del() {
    if (!confirm(`Delete ${v.label}?`)) return;
    setErr(null);
    try { await api.deleteVariant(v.id); onChanged(); } catch (e) { setErr(cleanErr(e)); }
  }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="input" value={attrs} onChange={(e) => setAttrs(e.target.value)} placeholder="key:value, …" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="text-xs text-ink-500">Base $<input className="input mt-1" type="number" value={base} onChange={(e) => setBase(e.target.value)} /></label>
        <label className="text-xs text-ink-500">Floor $<input className="input mt-1" type="number" value={floor} onChange={(e) => setFloor(e.target.value)} /></label>
        <label className="text-xs text-ink-500">Ceiling $<input className="input mt-1" type="number" value={ceiling} onChange={(e) => setCeiling(e.target.value)} /></label>
      </div>
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button className="btn-primary px-3 py-1.5 text-sm" onClick={save}>Save</button>
        <SavedFlag on={saved} />
        {canDelete && <button className="ml-auto text-xs font-semibold text-ink-400 hover:text-red-600" onClick={del}>Delete</button>}
      </div>
    </div>
  );
}

/* ---- conditions ---- */
function Conditions({ model, onChanged }: { model: AdminModelDetail; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addQuestion() {
    setErr(null);
    try {
      await api.addCondition(model.id, {
        key: `attr${Date.now().toString().slice(-4)}`, kind: "FUNCTIONAL", label: "New question", helper: null,
        options: [{ key: "opt1", label: "Option 1", helper: null, multiplier: 1.0 }],
      });
      setAdding(false);
      onChanged();
    } catch (e) {
      setErr(cleanErr(e));
    }
  }

  return (
    <section className="card space-y-3 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Condition questions</h2>
        <button className="btn-ghost text-sm" onClick={addQuestion}>+ Add question</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {model.conditionAttributes.map((a) => <ConditionRow key={a.id} a={a} onChanged={onChanged} canDelete={model.conditionAttributes.length > 1} />)}
    </section>
  );
}

function ConditionRow({ a, onChanged, canDelete }: { a: AdminModelDetail["conditionAttributes"][number]; onChanged: () => void; canDelete: boolean }) {
  const [label, setLabel] = useState(a.label);
  const [kind, setKind] = useState(a.kind);
  const [options, setOptions] = useState(a.options.map((o) => ({ key: o.key, label: o.label, multiplier: String(o.multiplier) })));
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    try {
      await api.updateCondition(a.id, {
        key: a.key, kind: kind as (typeof CONDITION_KINDS)[number], label, helper: null,
        options: options.map((o) => ({ key: o.key || o.label.toLowerCase().replace(/\s+/g, "_"), label: o.label, helper: null, multiplier: Number(o.multiplier) })),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onChanged();
    } catch (e) {
      setErr(cleanErr(e));
    }
  }
  async function del() {
    if (!confirm(`Delete "${a.label}"?`)) return;
    try { await api.deleteCondition(a.id); onChanged(); } catch (e) { setErr(cleanErr(e)); }
  }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          {CONDITION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="mt-2 space-y-1.5">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input flex-1" value={o.label} onChange={(e) => setOptions((os) => os.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <input className="input w-24" type="number" step="0.01" value={o.multiplier} onChange={(e) => setOptions((os) => os.map((x, j) => j === i ? { ...x, multiplier: e.target.value } : x))} />
            {options.length > 1 && <button className="px-1 text-ink-300 hover:text-red-600" onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        <button className="text-xs font-semibold text-brand-700" onClick={() => setOptions((os) => [...os, { key: `opt${os.length + 1}`, label: "", multiplier: "1.0" }])}>+ option</button>
      </div>
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button className="btn-primary px-3 py-1.5 text-sm" onClick={save}>Save</button>
        <SavedFlag on={saved} />
        {canDelete && <button className="ml-auto text-xs font-semibold text-ink-400 hover:text-red-600" onClick={del}>Delete question</button>}
      </div>
    </div>
  );
}

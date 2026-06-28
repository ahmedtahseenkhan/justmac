"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONDITION_KINDS, type CatalogCategoryDto, type ConditionAttributeInput } from "@sellme/shared";
import { api } from "@/lib/api";
import { RequireRole } from "@/components/admin/RequireRole";

type VariantRow = { label: string; attrs: string; baseValue: string; floor: string; ceiling: string };
type CondOpt = { key: string; label: string; multiplier: string };
type CondAttr = { key: string; kind: string; label: string; helper: string; options: CondOpt[] };

const PHONE_TREE: CondAttr[] = [
  { key: "cosmetic", kind: "COSMETIC", label: "Cosmetic condition", helper: "", options: [
    { key: "flawless", label: "Flawless", multiplier: "1.0" }, { key: "good", label: "Good — light wear", multiplier: "0.88" },
    { key: "fair", label: "Fair — visible wear", multiplier: "0.7" }, { key: "cracked", label: "Cracked", multiplier: "0.45" }] },
  { key: "functional", kind: "FUNCTIONAL", label: "Does it work?", helper: "", options: [
    { key: "fully_working", label: "Fully working", multiplier: "1.0" }, { key: "minor_issues", label: "Minor issues", multiplier: "0.8" },
    { key: "wont_power", label: "Won't power on", multiplier: "0.35" }] },
  { key: "battery", kind: "BATTERY", label: "Battery health", helper: "", options: [
    { key: "ge_90", label: "90%+", multiplier: "1.0" }, { key: "ge_80", label: "80–89%", multiplier: "0.95" }, { key: "lt_80", label: "Below 80%", multiplier: "0.85" }] },
  { key: "accessories", kind: "ACCESSORIES", label: "Charger included?", helper: "", options: [
    { key: "with_charger", label: "Yes", multiplier: "1.02" }, { key: "no_charger", label: "No", multiplier: "1.0" }] },
  { key: "carrier_lock", kind: "CARRIER_LOCK", label: "Carrier & lock", helper: "", options: [
    { key: "unlocked", label: "Unlocked", multiplier: "1.0" }, { key: "locked", label: "Locked", multiplier: "0.85" }, { key: "financed", label: "Financed", multiplier: "0.6" }] },
];
const LAPTOP_TREE: CondAttr[] = [
  { key: "cosmetic", kind: "COSMETIC", label: "Cosmetic condition", helper: "", options: [
    { key: "flawless", label: "Flawless", multiplier: "1.0" }, { key: "good", label: "Good", multiplier: "0.87" },
    { key: "fair", label: "Fair", multiplier: "0.68" }, { key: "cracked", label: "Cracked", multiplier: "0.4" }] },
  { key: "functional", kind: "FUNCTIONAL", label: "Keyboard, trackpad & ports", helper: "", options: [
    { key: "fully_working", label: "Everything works", multiplier: "1.0" }, { key: "minor_issues", label: "Minor issues", multiplier: "0.82" }, { key: "wont_boot", label: "Won't boot", multiplier: "0.35" }] },
  { key: "battery", kind: "BATTERY", label: "Battery health", helper: "", options: [
    { key: "healthy", label: "Healthy", multiplier: "1.0" }, { key: "worn", label: "Worn", multiplier: "0.9" }, { key: "service", label: "Needs service", multiplier: "0.78" }] },
  { key: "accessories", kind: "ACCESSORIES", label: "Charger included?", helper: "", options: [
    { key: "with_charger", label: "Yes", multiplier: "1.03" }, { key: "no_charger", label: "No", multiplier: "1.0" }] },
];

export default function NewDevicePage() {
  return (
    <RequireRole role="ADMIN">
      <AddDevice />
    </RequireRole>
  );
}

function AddDevice() {
  const router = useRouter();
  const [cats, setCats] = useState<CatalogCategoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([{ label: "", attrs: "", baseValue: "", floor: "", ceiling: "" }]);
  const [tree, setTree] = useState<CondAttr[]>(PHONE_TREE);

  // inline create
  const [newCat, setNewCat] = useState("");
  const [newBrand, setNewBrand] = useState("");

  async function loadCats() {
    const c = await api.catalogAdminCategories();
    setCats(c);
    return c;
  }
  useEffect(() => {
    void loadCats();
  }, []);

  const slug = useMemo(() => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), [name]);
  const brands = cats.find((c) => c.id === categoryId)?.brands ?? [];

  async function addCategory() {
    if (!newCat.trim()) return;
    try {
      await api.createCategory({ slug: newCat, name: newCat, targetMargin: 0.25 });
      const c = await loadCats();
      const created = c.find((x) => x.name.toLowerCase() === newCat.trim().toLowerCase());
      if (created) setCategoryId(created.id);
      setNewCat("");
    } catch (e) {
      setError(cleanErr(e));
    }
  }
  async function addBrand() {
    if (!newBrand.trim() || !categoryId) return;
    try {
      await api.createBrand({ slug: newBrand, name: newBrand, categoryId });
      const c = await loadCats();
      const created = c.find((x) => x.id === categoryId)?.brands.find((b) => b.name.toLowerCase() === newBrand.trim().toLowerCase());
      if (created) setBrandId(created.id);
      setNewBrand("");
    } catch (e) {
      setError(cleanErr(e));
    }
  }

  function setVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  }

  async function submit() {
    setError(null);
    if (!name || !categoryId || !brandId) return setError("Pick a category, brand and name.");
    try {
      setBusy(true);
      const body = {
        name,
        slug,
        imageUrl: null,
        categoryId,
        brandId,
        variants: variants
          .filter((v) => v.label.trim())
          .map((v) => ({
            label: v.label.trim(),
            attributes: parseAttrs(v.attrs),
            baseValue: Number(v.baseValue),
            floor: Number(v.floor),
            ceiling: Number(v.ceiling),
          })),
        conditionAttributes: tree.map<ConditionAttributeInput>((a) => ({
          key: a.key,
          kind: a.kind as ConditionAttributeInput["kind"],
          label: a.label,
          helper: a.helper || null,
          options: a.options.map((o) => ({ key: o.key, label: o.label, helper: null, multiplier: Number(o.multiplier) })),
        })),
      };
      if (body.variants.length === 0) return setError("Add at least one variant with a price.");
      const res = await api.createModel(body);
      router.push(`/admin/catalog?added=${res.slug}`);
    } catch (e) {
      setError(cleanErr(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/catalog" className="text-sm font-semibold text-brand-700 hover:underline">← Catalog</Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">Add a device</h1>
        <p className="text-ink-500">Create a model with its configurations, condition tree and prices — it goes live instantly.</p>
      </div>

      {/* Model */}
      <section className="card space-y-4 p-6">
        <h2 className="font-semibold">Device</h2>
        <Field label="Model name">
          <input className="input" placeholder="e.g. iPhone 16 Pro" value={name} onChange={(e) => setName(e.target.value)} />
          {slug && <p className="mt-1 text-xs text-ink-400">slug: {slug}</p>}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select className="input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setBrandId(""); setTree(e.target.options[e.target.selectedIndex].text.toLowerCase().includes("laptop") ? LAPTOP_TREE : PHONE_TREE); }}>
              <option value="">Choose…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <input className="input" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <button type="button" className="btn-ghost" onClick={addCategory}>Add</button>
            </div>
          </Field>
          <Field label="Brand">
            <select className="input" value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={!categoryId}>
              <option value="">{categoryId ? "Choose…" : "Pick a category first"}</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <input className="input" placeholder="New brand" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} disabled={!categoryId} />
              <button type="button" className="btn-ghost" onClick={addBrand} disabled={!categoryId}>Add</button>
            </div>
          </Field>
        </div>
      </section>

      {/* Variants */}
      <section className="card space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Configurations &amp; prices</h2>
          <button type="button" className="btn-ghost text-sm" onClick={() => setVariants((v) => [...v, { label: "", attrs: "", baseValue: "", floor: "", ceiling: "" }])}>+ Add</button>
        </div>
        <p className="text-xs text-ink-400">Attributes: comma-separated <code className="rounded bg-canvas px-1">key:value</code> (e.g. storage:256GB, color:Black).</p>
        {variants.map((v, i) => (
          <div key={i} className="rounded-xl border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input" placeholder="Label (e.g. 256GB)" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} />
              <input className="input" placeholder="storage:256GB, color:Black" value={v.attrs} onChange={(e) => setVariant(i, { attrs: e.target.value })} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <NumField label="Base $" value={v.baseValue} onChange={(x) => setVariant(i, { baseValue: x })} />
              <NumField label="Floor $" value={v.floor} onChange={(x) => setVariant(i, { floor: x })} />
              <NumField label="Ceiling $" value={v.ceiling} onChange={(x) => setVariant(i, { ceiling: x })} />
            </div>
            {variants.length > 1 && (
              <button type="button" className="mt-2 text-xs font-semibold text-ink-400 hover:text-red-600" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}>Remove</button>
            )}
          </div>
        ))}
      </section>

      {/* Condition tree */}
      <section className="card space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Condition questions</h2>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost text-sm" onClick={() => setTree(PHONE_TREE)}>Phone template</button>
            <button type="button" className="btn-ghost text-sm" onClick={() => setTree(LAPTOP_TREE)}>Laptop template</button>
          </div>
        </div>
        <p className="text-xs text-ink-400">Each multiplier scales the offer (1.0 = no change). Edit, or load a template and tweak.</p>
        {tree.map((a, ai) => (
          <div key={ai} className="rounded-xl border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
              <input className="input" value={a.label} onChange={(e) => setTree((t) => t.map((x, j) => j === ai ? { ...x, label: e.target.value } : x))} placeholder="Question label" />
              <select className="input" value={a.kind} onChange={(e) => setTree((t) => t.map((x, j) => j === ai ? { ...x, kind: e.target.value } : x))}>
                {CONDITION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="mt-2 space-y-1.5">
              {a.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input className="input flex-1" value={o.label} onChange={(e) => updateOpt(setTree, ai, oi, { label: e.target.value })} placeholder="Option" />
                  <input className="input w-24" type="number" step="0.01" value={o.multiplier} onChange={(e) => updateOpt(setTree, ai, oi, { multiplier: e.target.value })} />
                  <button type="button" className="px-1 text-ink-300 hover:text-red-600" onClick={() => setTree((t) => t.map((x, j) => j === ai ? { ...x, options: x.options.filter((_, k) => k !== oi) } : x))}>✕</button>
                </div>
              ))}
              <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setTree((t) => t.map((x, j) => j === ai ? { ...x, options: [...x.options, { key: `opt${x.options.length + 1}`, label: "", multiplier: "1.0" }] } : x))}>+ option</button>
            </div>
            <button type="button" className="mt-2 text-xs font-semibold text-ink-400 hover:text-red-600" onClick={() => setTree((t) => t.filter((_, j) => j !== ai))}>Remove question</button>
          </div>
        ))}
        <button type="button" className="btn-ghost text-sm" onClick={() => setTree((t) => [...t, { key: `attr${t.length + 1}`, kind: "FUNCTIONAL", label: "", helper: "", options: [{ key: "opt1", label: "", multiplier: "1.0" }] }])}>+ Add question</button>
      </section>

      {error && <p className="text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy} onClick={submit}>
        {busy ? "Creating…" : "Create device"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>{children}</label>;
}
function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs text-ink-500">{label}<input className="input mt-1" type="number" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
function updateOpt(setTree: React.Dispatch<React.SetStateAction<CondAttr[]>>, ai: number, oi: number, patch: Partial<CondOpt>) {
  setTree((t) => t.map((x, j) => j === ai ? { ...x, options: x.options.map((o, k) => k === oi ? { ...o, ...patch } : o) } : x));
}
function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of s.split(",")) {
    const [k, ...rest] = pair.split(":");
    if (k && rest.length) out[k.trim()] = rest.join(":").trim();
  }
  return out;
}
function cleanErr(e: unknown): string {
  if (!(e instanceof Error)) return "Something went wrong.";
  const m = e.message.match(/"message":"([^"]+)"/);
  return m ? m[1] : e.message.replace(/^API \d+ on \S+ /, "");
}

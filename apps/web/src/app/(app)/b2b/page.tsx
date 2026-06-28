"use client";

import { useState } from "react";
import Link from "next/link";
import { BATCH_TYPES, type BatchDto, type BatchType, type BulkDeviceInput } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { BatchDevices } from "@/components/BatchDevices";
import { FEATURES } from "@/lib/features";
import { ComingSoon } from "@/components/ComingSoon";

export default function B2bPage() {
  if (!FEATURES.business) {
    return (
      <ComingSoon
        title="Business & ITAD"
        blurb="Bulk trade-ins, IT asset disposition and net-terms invoicing for businesses are launching soon. Selling a single device? Get an instant quote."
      />
    );
  }
  return <B2bIntake />;
}

function B2bIntake() {
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [netTermsDays, setNetTermsDays] = useState(30);
  const [type, setType] = useState<BatchType>("BUYBACK");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchDto | null>(null);

  function parseCsv(): BulkDeviceInput[] {
    return csv
      .trim()
      .split("\n")
      .map((l) => l.split(",").map((c) => c.trim()))
      .filter((c) => c[0] && c[0].toLowerCase() !== "modelslug")
      .map((c) => ({ modelSlug: c[0], variantLabel: c[1] ?? "", serial: c[2] || undefined }));
  }

  async function submit() {
    setError(null);
    const devices = parseCsv();
    if (devices.length === 0) {
      setError("Add at least one device row: modelSlug,variantLabel,serial");
      return;
    }
    setBusy(true);
    try {
      const result = await api.createBatch({
        company,
        contactName,
        contactEmail,
        netTermsDays,
        type,
        devices,
      });
      setBatch(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  if (batch) return <BatchResult batch={batch} onNew={() => setBatch(null)} />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Business &amp; ITAD</h1>
          <p className="mt-2 text-ink-500">
            Bulk trade-in or IT asset disposition for 10+ devices. Upload a manifest, get a
            preliminary valuation or destruction certificates, and a dedicated account manager.
          </p>
        </div>
        <Link href="/b2b/batches" className="btn-ghost">Manager dashboard</Link>
      </div>

      <div className="card mt-6 space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <input className="input" placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <input className="input" type="email" placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-ink-500">
            Net terms
            <input type="number" className="input w-24" value={netTermsDays} onChange={(e) => setNetTermsDays(Number(e.target.value))} />
            days
          </label>
        </div>

        <div className="flex gap-2">
          {BATCH_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg border p-3 text-sm font-medium ${
                type === t ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-gray-200"
              }`}
            >
              {t === "BUYBACK" ? "💵 Bulk buyback" : "🔒 ITAD / data destruction"}
            </button>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium text-ink-700">
            Device manifest (CSV: <code className="rounded bg-gray-100 px-1">modelSlug,variantLabel,serial</code>)
          </label>
          <textarea
            className="input mt-1 h-40 font-mono text-xs"
            placeholder={"iphone-14,128GB,SN001\niphone-14,128GB,SN002\nmacbook-air-m3-13,8GB / 256GB,SN003"}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              className="text-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setCsv(await f.text());
              }}
            />
            <span className="text-xs text-ink-300">{parseCsv().length} devices parsed</span>
          </div>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        <button
          className="btn-primary w-full"
          disabled={busy || !company || !contactName || !/.+@.+\..+/.test(contactEmail)}
          onClick={submit}
        >
          {busy ? "Processing…" : `Submit ${type === "BUYBACK" ? "buyback" : "ITAD"} batch`}
        </button>
      </div>
    </div>
  );
}

function BatchResult({ batch, onNew }: { batch: BatchDto; onNew: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <p className="text-sm text-brand-900">
          ✅ Batch <span className="font-mono font-bold">{batch.reference}</span> processed ·
          routed to <span className="font-semibold">{batch.manager}</span>
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Type" value={batch.type} />
        <Stat label="Devices" value={String(batch.deviceCount)} />
        <Stat
          label={batch.type === "BUYBACK" ? "Total value" : "Payout"}
          value={batch.type === "BUYBACK" ? money(batch.totalValue) : "—"}
          accent
        />
        <Stat label="Status" value={batch.status} />
      </div>

      {batch.invoice && (
        <div className="card mt-4 flex items-center justify-between p-5">
          <div>
            <p className="font-semibold">Invoice {batch.invoice.number}</p>
            <p className="text-sm text-ink-500">
              Net-{batch.invoice.netTermsDays} · due {batch.invoice.dueDate.slice(0, 10)} · {batch.invoice.status}
            </p>
          </div>
          <p className="text-2xl font-extrabold text-brand-600">{money(batch.invoice.amount)}</p>
        </div>
      )}

      <BatchDevices batch={batch} />

      <button className="btn-ghost mt-6" onClick={onNew}>Submit another batch</button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-300">{label}</p>
      <p className={`text-xl font-extrabold ${accent ? "text-brand-600" : ""}`}>{value}</p>
    </div>
  );
}

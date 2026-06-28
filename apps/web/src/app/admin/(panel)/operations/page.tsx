"use client";

import { useEffect, useState } from "react";
import {
  LIFECYCLE_LABELS,
  type ConditionAttributeDto,
  type ConditionSelection,
  type OrderDto,
  type OrderItemDto,
} from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function OpsPage() {
  const [queue, setQueue] = useState<OrderDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setQueue(await api.opsQueue());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Ops — grading queue</h1>
          <p className="mt-1 text-ink-500">Intake shipments, screen, and grade devices.</p>
        </div>
        <button className="btn-ghost" onClick={refresh}>Refresh</button>
      </div>

      {error && <p className="mt-6 text-red-600">{error}</p>}
      {queue && queue.length === 0 && (
        <p className="card mt-6 p-6 text-ink-500">Queue is empty. Place a trade-in, then check out to populate it.</p>
      )}

      <div className="mt-6 space-y-4">
        {queue?.map((o) => <OpsCard key={o.id} order={o} onUpdated={refresh} />)}
      </div>
    </div>
  );
}

function OpsCard({ order, onUpdated }: { order: OrderDto; onUpdated: () => void }) {
  const [serial, setSerial] = useState("");
  const [imei, setImei] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canIntake = order.state === "LABEL_ISSUED" || order.state === "IN_TRANSIT";
  const canInspect = order.state === "RECEIVED" || order.state === "INSPECTING";

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono font-bold">{order.trackingId}</span>
          <span className="ml-2 text-sm text-ink-500">{order.fullName}</span>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-ink-700">
          {LIFECYCLE_LABELS[order.state]}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-500">
        {order.items.length} device · quoted {money(order.totalOffer, order.currency)}
      </p>

      {/* Intake */}
      {canIntake && (
        <div className="mt-4 rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold">Intake &amp; screen</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-ink-500">
              Serial / IMEI
              <input
                className="input mt-1 w-48"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="try LCK… or BLK… to flag"
              />
            </label>
            <label className="text-xs text-ink-500">
              IMEI (optional)
              <input className="input mt-1 w-44" value={imei} onChange={(e) => setImei(e.target.value)} />
            </label>
            <button
              className="btn-primary"
              disabled={busy || !serial}
              onClick={() => run(() => api.opsIntake(order.trackingId, { serial, imei: imei || undefined }))}
            >
              Receive &amp; screen
            </button>
          </div>
        </div>
      )}

      {/* Inspect each device */}
      {canInspect &&
        order.items.map((it) => (
          <InspectForm key={it.id} item={it} busy={busy} onSubmit={(body) => run(() => api.opsInspect(it.id, body))} />
        ))}

      {/* Post-inspection summary */}
      {order.items.map((it) =>
        it.device?.inspection?.outcome ? (
          <p key={it.id} className="mt-3 text-sm">
            <span className="font-medium">{it.modelName}:</span>{" "}
            <span className={it.device.inspection.outcome === "ADJUSTED" ? "text-amber-700" : "text-brand-700"}>
              {it.device.inspection.outcome}
            </span>{" "}
            → {money(it.device.inspection.adjustedOffer ?? it.offer, order.currency)}
            {order.state === "OFFER_ADJUSTED" || order.state === "OFFER_CONFIRMED" ? (
              <span className="ml-2 text-xs text-ink-300">awaiting seller response</span>
            ) : null}
          </p>
        ) : null,
      )}

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function InspectForm({
  item,
  busy,
  onSubmit,
}: {
  item: OrderItemDto;
  busy: boolean;
  onSubmit: (body: { inspector: string; gradedConditions: ConditionSelection[]; findings?: string }) => void;
}) {
  // Grading form is driven by the device's own model — phones and laptops grade
  // on different dimensions.
  const [attrs, setAttrs] = useState<ConditionAttributeDto[] | null>(null);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [inspector, setInspector] = useState("jane");
  const [findings, setFindings] = useState("");

  useEffect(() => {
    let active = true;
    api.getModel(item.modelSlug).then((m) => {
      if (!active) return;
      setAttrs(m.conditionAttributes);
      setGrades(Object.fromEntries(m.conditionAttributes.map((a) => [a.key, a.options[0]?.key])));
    });
    return () => {
      active = false;
    };
  }, [item.modelSlug]);

  if (item.device?.inspection) return null; // already graded

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-semibold">Grade: {item.modelName} {item.variantLabel}</p>
      {!item.device && <p className="mt-1 text-xs text-amber-700">Run intake first.</p>}
      {!attrs ? (
        <p className="mt-2 text-xs text-ink-300">Loading grading form…</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-ink-500">
              Inspector
              <input className="input mt-1 w-28" value={inspector} onChange={(e) => setInspector(e.target.value)} />
            </label>
            <label className="flex-1 text-xs text-ink-500">
              Findings
              <input className="input mt-1" value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="notes…" />
            </label>
            <button
              className="btn-primary"
              disabled={busy || !item.device || !inspector}
              onClick={() =>
                onSubmit({
                  inspector,
                  findings: findings || undefined,
                  gradedConditions: attrs.map((a) => ({ attributeKey: a.key, optionKey: grades[a.key] })),
                })
              }
            >
              Submit grade
            </button>
          </div>
        </>
      )}
    </div>
  );
}

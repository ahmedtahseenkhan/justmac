"use client";

import { useState } from "react";
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_TRANSITIONS,
  type LifecycleState,
  type OrderDto,
} from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

const TIMELINE: LifecycleState[] = [
  "QUOTE_LOCKED",
  "LABEL_ISSUED",
  "IN_TRANSIT",
  "RECEIVED",
  "INSPECTING",
  "OFFER_CONFIRMED",
  "ACCEPTED",
  "PAID",
];

export function OrderTrack({ order: initial, justPlaced }: { order: OrderDto; justPlaced: boolean }) {
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState(false);

  const currentIdx = TIMELINE.indexOf(order.state);
  const nextStates = LIFECYCLE_TRANSITIONS[order.state] ?? [];
  const awaitingResponse = order.state === "OFFER_CONFIRMED" || order.state === "OFFER_ADJUSTED";

  async function advance(to: LifecycleState) {
    setBusy(true);
    try {
      setOrder(await api.advanceOrder(order.trackingId, to));
    } finally {
      setBusy(false);
    }
  }
  async function respond(decision: "ACCEPT" | "REJECT") {
    setBusy(true);
    try {
      setOrder(await api.respondOrder(order.trackingId, { decision }));
    } finally {
      setBusy(false);
    }
  }

  // Demo control hides the response transitions — those belong to the Fair-Evaluation card.
  const demoStates = nextStates.filter((s) => !["ACCEPTED", "REJECTED"].includes(s));

  return (
    <div className="mx-auto max-w-2xl">
      {justPlaced && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          🎉 Trade-in confirmed! We emailed your prepaid label to {order.email}.
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-300">Tracking ID</p>
          <h1 className="font-mono text-2xl font-extrabold">{order.trackingId}</h1>
        </div>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-700">
          {LIFECYCLE_LABELS[order.state]}
        </span>
      </div>

      {/* Timeline */}
      <ol className="card mt-6 space-y-1 p-6">
        {TIMELINE.map((state, i) => {
          const done = currentIdx >= 0 && i <= currentIdx;
          const active = i === currentIdx;
          return (
            <li key={state} className="flex items-center gap-3 py-1.5">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                  done ? "bg-brand-600 text-white" : "bg-gray-200 text-ink-300"
                } ${active ? "ring-2 ring-brand-300 ring-offset-2" : ""}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-sm ${active ? "font-bold" : done ? "font-medium" : "text-ink-300"}`}>
                {LIFECYCLE_LABELS[state]}
              </span>
            </li>
          );
        })}
        {(order.state === "OFFER_ADJUSTED" || order.state === "REJECTED" || order.state === "RETURNED") && (
          <li className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Status: {LIFECYCLE_LABELS[order.state]}
          </li>
        )}
      </ol>

      {/* Fair-Evaluation: respond to the post-inspection offer */}
      {awaitingResponse && (
        <div
          className={`card mt-6 p-6 ${order.state === "OFFER_ADJUSTED" ? "border-amber-300" : "border-brand-300"}`}
        >
          {order.state === "OFFER_ADJUSTED" ? (
            <>
              <h2 className="text-lg font-bold text-amber-800">Your offer was adjusted</h2>
              <p className="mt-1 text-sm text-ink-500">
                Inspection found your device differs from the quote. Here's what we found:
              </p>
              <div className="mt-4 flex items-end gap-6">
                <div>
                  <p className="text-xs text-ink-300">Original quote</p>
                  <p className="text-xl font-semibold text-ink-300 line-through">{money(order.totalOffer, order.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-300">Adjusted offer</p>
                  <p className="text-3xl font-extrabold text-amber-700">
                    {money(order.proposedTotal ?? order.totalOffer, order.currency)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-brand-700">Inspection confirmed your offer 🎉</h2>
              <p className="mt-1 text-sm text-ink-500">Everything checked out. Accept to get paid.</p>
              <p className="mt-3 text-3xl font-extrabold text-brand-700">{money(order.totalOffer, order.currency)}</p>
            </>
          )}

          {/* Inspector findings */}
          {order.items.map((it) =>
            it.device?.inspection?.findings ? (
              <p key={it.id} className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-ink-500">
                <span className="font-medium text-ink-700">Inspector ({it.device.inspection.inspector}):</span>{" "}
                {it.device.inspection.findings}
              </p>
            ) : null,
          )}

          <div className="mt-5 flex gap-3">
            <button className="btn-primary flex-1" disabled={busy} onClick={() => respond("ACCEPT")}>
              Accept &amp; get paid
            </button>
            {order.state === "OFFER_ADJUSTED" && (
              <button className="btn-ghost flex-1" disabled={busy} onClick={() => respond("REJECT")}>
                Reject — return my device free
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-300">
            Fair-Evaluation Promise: reject and we ship your device back at no cost.
          </p>
        </div>
      )}

      {/* Summary + device detail */}
      <div className="card mt-6 p-6">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {order.items.map((it) => (
            <li key={it.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
              <div className="flex justify-between">
                <span className="text-ink-500">
                  {it.modelName} <span className="text-ink-300">{it.variantLabel}</span>
                </span>
                <span className="font-medium">{money(it.offer, order.currency)}</span>
              </div>
              {it.device?.serial && (
                <p className="mt-1 text-xs text-ink-300">Serial {it.device.serial}</p>
              )}
              {it.device?.screening && it.device.screening.flags.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {it.device.screening.flags.map((f, i) => (
                    <li key={i} className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                      ⚠ {f}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-gray-100 pt-4 font-bold">
          <span>Total payout · {order.payoutMethod}</span>
          <span className="text-brand-600">{money(order.totalOffer, order.currency)}</span>
        </div>
        {order.labelUrl && (
          <a href={order.labelUrl} className="btn-ghost mt-4 w-full" target="_blank" rel="noreferrer">
            Re-print shipping label
          </a>
        )}
      </div>

      {/* Activity feed (notifications) */}
      {order.notifications && order.notifications.length > 0 && (
        <div className="card mt-6 p-6">
          <h2 className="font-semibold">Activity</h2>
          <ul className="mt-3 space-y-2">
            {[...order.notifications]
              .filter((n) => n.channel === "EMAIL")
              .reverse()
              .map((n) => (
                <li key={n.id} className="flex gap-3 text-sm">
                  <span className="mt-0.5 text-ink-300">✉️</span>
                  <div>
                    <p className="font-medium">{n.subject}</p>
                    <p className="text-ink-500">{n.body}</p>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Demo control — stands in for back-office / carrier webhooks */}
      {demoStates.length > 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">
            Demo: simulate next step
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {demoStates.map((s) => (
              <button key={s} disabled={busy} onClick={() => advance(s)} className="btn-ghost text-sm">
                → {LIFECYCLE_LABELS[s]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-300">
            Or use the <a href="/ops" className="underline">ops back-office</a> to intake &amp; grade.
          </p>
        </div>
      )}
    </div>
  );
}

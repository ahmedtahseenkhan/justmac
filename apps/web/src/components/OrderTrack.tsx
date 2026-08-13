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

// Seller-facing "what happens next" guidance per state.
const CUSTOMER_HINTS: Partial<Record<LifecycleState, string>> = {
  LABEL_ISSUED: "Pack your device, drop it off with the prepaid label, then tap the button above so we know it's coming.",
  IN_TRANSIT: "Your package is on its way. We'll email you the moment it arrives at our facility.",
  RECEIVED: "Your device has arrived. Our team will inspect it — this usually takes 1 business day.",
  INSPECTING: "Our technicians are verifying your device's condition against your quote.",
  OFFER_CONFIRMED: "Inspection matched your quote — accept below and we'll send your payout.",
  OFFER_ADJUSTED: "Inspection found a difference. Review the adjusted offer below — accept it, or reject for a free return.",
  ACCEPTED: "Your payout is being processed via your chosen method.",
  PAID: "All done — your payout has been sent. Thanks for trading with JustMac!",
  REJECTED: "We're preparing your device for free return shipping.",
  RETURNED: "Your device has been shipped back to you at no cost.",
};

/**
 * Order tracking view, shared by the customer (/track/:id) and the back office
 * (/admin/orders/:id). Customers get a centered single column; staff get a
 * full-width two-column workspace with actions at the top. Advancing the
 * lifecycle is an OPS action (the API enforces this); accept/reject
 * (Fair-Evaluation) stays with the customer.
 */
export function OrderTrack({
  order: initial,
  justPlaced,
  admin = false,
}: {
  order: OrderDto;
  justPlaced: boolean;
  admin?: boolean;
}) {
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [adjustDraft, setAdjustDraft] = useState<Record<string, string>>({});
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);

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
  async function shipped() {
    setBusy(true);
    try {
      setOrder(await api.markShipped(order.trackingId));
    } finally {
      setBusy(false);
    }
  }

  // Manual advance is a stand-in for carrier webhooks. It can only move the STATUS,
  // so transitions whose meaning depends on data it can't produce are excluded:
  // ACCEPTED/REJECTED belong to the customer's Fair-Evaluation card, and
  // OFFER_ADJUSTED must come from grading (that's where the adjusted price is
  // computed — advancing without an inspection would show "adjusted" at the same $).
  const demoStates = nextStates.filter(
    (s) => !["ACCEPTED", "REJECTED", "OFFER_ADJUSTED"].includes(s),
  );
  const canAdjustViaGrading = nextStates.includes("OFFER_ADJUSTED");
  // Manual price edit is allowed until the customer has answered the offer.
  const canAdjustManually =
    admin &&
    ["QUOTE_LOCKED", "LABEL_ISSUED", "IN_TRANSIT", "RECEIVED", "INSPECTING", "OFFER_ADJUSTED"].includes(
      order.state,
    );

  async function submitAdjust() {
    setBusy(true);
    setAdjustError(null);
    try {
      const items = order.items.map((it) => ({
        orderItemId: it.id,
        offer: Number(adjustDraft[it.id] ?? it.offer),
      }));
      if (items.some((i) => !Number.isFinite(i.offer) || i.offer <= 0)) {
        setAdjustError("Enter a valid price for each device.");
        return;
      }
      setOrder(await api.opsAdjustOffer(order.trackingId, { items, note: adjustNote || undefined }));
      setAdjustDraft({});
      setAdjustNote("");
    } catch (e) {
      setAdjustError(e instanceof Error ? e.message : "Failed to adjust the offer.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- building blocks (shared by both layouts) ---------------- */

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-300">Tracking ID</p>
        <h1 className="font-mono text-2xl font-extrabold">{order.trackingId}</h1>
      </div>
      <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-700">
        {LIFECYCLE_LABELS[order.state]}
      </span>
    </div>
  );

  const staffBar = admin && (demoStates.length > 0 || canAdjustViaGrading) && (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-2 text-xs font-semibold uppercase tracking-wide text-ink-300">
          Staff actions
        </p>
        {demoStates.map((s) => (
          <button key={s} disabled={busy} onClick={() => advance(s)} className="btn-ghost text-sm">
            → {LIFECYCLE_LABELS[s]}
          </button>
        ))}
        <a href="/admin/operations" className="btn-primary px-3 py-1.5 text-sm">
          Grade in grading queue
        </a>
      </div>
      <p className="mt-2 text-xs text-ink-400">
        {canAdjustViaGrading
          ? "Set a new price in “Adjust offer” below, or grade the device in the grading queue to calculate it from the inspected condition."
          : "Status shortcuts stand in for carrier webhooks. Intake & grading happen in the grading queue."}
      </p>
    </div>
  );

  const adjustCard = canAdjustManually && (
    <div className="card border-amber-200 p-6">
      <h2 className="text-lg font-bold">Adjust offer</h2>
      <p className="mt-1 text-sm text-ink-500">
        Set the price you&apos;ll actually pay — the customer gets the original quote crossed out
        next to your new offer and chooses accept or free return. Prefer a calculated price? Grade
        the device in the grading queue instead.
      </p>
      <div className="mt-4 space-y-2">
        {order.items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-center gap-3">
            <span className="min-w-40 text-sm text-ink-500">
              {it.modelName} <span className="text-ink-300">{it.variantLabel}</span>
            </span>
            <span className="text-xs text-ink-300">quoted {money(it.offer, order.currency)} →</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-ink-400">$</span>
              <input
                type="number"
                min={1}
                className="input w-28 py-1.5 text-right tabular-nums"
                value={adjustDraft[it.id] ?? String(it.device?.inspection?.adjustedOffer ?? it.offer)}
                disabled={busy}
                onChange={(e) => setAdjustDraft((d) => ({ ...d, [it.id]: e.target.value }))}
              />
            </div>
          </div>
        ))}
        <input
          className="input w-full"
          placeholder="Reason shown to the customer (e.g. “screen has deep scratches”)"
          value={adjustNote}
          disabled={busy}
          onChange={(e) => setAdjustNote(e.target.value)}
        />
      </div>
      {adjustError && <p className="mt-2 text-xs text-red-600">{adjustError}</p>}
      <button className="btn-primary mt-4" disabled={busy} onClick={submitAdjust}>
        {busy ? "Sending…" : order.state === "OFFER_ADJUSTED" ? "Update adjusted offer" : "Send adjusted offer to customer"}
      </button>
    </div>
  );

  const timelineCard = (
    <ol className="card space-y-1 p-6">
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
  );

  const fairEvalCard = awaitingResponse && (
    <div className={`card p-6 ${order.state === "OFFER_ADJUSTED" ? "border-amber-300" : "border-brand-300"}`}>
      {order.state === "OFFER_ADJUSTED" ? (
        <>
          <h2 className="text-lg font-bold text-amber-800">
            {admin ? "Offer adjusted — awaiting customer response" : "Your offer was adjusted"}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Inspection found the device differs from the quote. What we found:
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
          <h2 className="text-lg font-bold text-brand-700">
            {admin ? "Offer confirmed — awaiting customer response" : "Inspection confirmed your offer 🎉"}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {admin ? "Inspection matched the quote." : "Everything checked out. Accept to get paid."}
          </p>
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

      {/* Accept/reject is the CUSTOMER's decision (Fair-Evaluation promise). */}
      {!admin ? (
        <>
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
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-ink-500">
          The customer decides from their tracking page: accept &amp; get paid, or reject for a free
          return.
        </p>
      )}
    </div>
  );

  const summaryCard = (
    <div className="card p-6">
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
            {it.device?.serial && <p className="mt-1 text-xs text-ink-300">Serial {it.device.serial}</p>}
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
  );

  const activityCard = order.notifications && order.notifications.length > 0 && (
    <div className="card p-6">
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
  );

  /* ---------------- staff layout: full width, two columns, actions on top ---------------- */

  if (admin) {
    return (
      <div className="space-y-6">
        {header}
        {staffBar}
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {fairEvalCard}
            {adjustCard}
            {summaryCard}
            {activityCard}
          </div>
          <div className="space-y-6">{timelineCard}</div>
        </div>
      </div>
    );
  }

  /* ---------------- customer layout: action first, two columns on wide screens ---------------- */

  const shippedCard = order.state === "LABEL_ISSUED" && (
    <div className="card border-brand-300 p-6">
      <h2 className="text-lg font-bold">Shipped your device?</h2>
      <p className="mt-1 text-sm text-ink-500">
        Print your prepaid label, pack the device, and drop it off at any carrier location. Then let
        us know it's on the way.
      </p>
      <button className="btn-primary mt-4 w-full" disabled={busy} onClick={shipped}>
        📦 I've shipped my device
      </button>
    </div>
  );

  const hintNote = CUSTOMER_HINTS[order.state] && (
    <p className="rounded-xl bg-white px-4 py-3 text-sm text-ink-500 shadow-sm">
      <span className="font-semibold text-ink-700">What happens next: </span>
      {CUSTOMER_HINTS[order.state]}
    </p>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {justPlaced && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          🎉 Trade-in confirmed! We emailed your prepaid label to {order.email}.
        </div>
      )}

      {header}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Action column first: the thing the customer needs to do is never below the fold. */}
        <div className="space-y-6 lg:col-span-2">
          {hintNote}
          {shippedCard}
          {fairEvalCard}
          {summaryCard}
        </div>
        <div className="space-y-6">
          {timelineCard}
          {activityCard}
        </div>
      </div>
    </div>
  );
}

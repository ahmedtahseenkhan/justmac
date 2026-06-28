"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PAYOUT_METHODS,
  SHIPPING_OPTIONS,
  instantPayoutFee,
  type PayoutMethod,
  type ShippingOption,
} from "@sellme/shared";
import { useCart } from "@/lib/cart";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { getStoredRef } from "@/components/RefCapture";

const PAYOUT_LABELS: Record<PayoutMethod, string> = {
  ACH: "ACH / bank transfer",
  PAYPAL: "PayPal",
  CHECK: "Paper check",
  ZELLE: "Zelle",
};
const PAYOUT_DETAIL_LABEL: Record<PayoutMethod, string> = {
  ACH: "Bank account number",
  PAYPAL: "PayPal email",
  CHECK: "Mailing address",
  ZELLE: "Zelle email or phone",
};
const SHIPPING_LABELS: Record<ShippingOption, { label: string; note: string }> = {
  PREPAID_LABEL: { label: "Free prepaid label", note: "Print at home · FedEx/UPS · 0$" },
  SHIPPING_KIT: { label: "Free shipping kit", note: "We mail you a box · adds 2–3 days" },
  EXPEDITED: { label: "Expedited", note: "Priority processing · faster payout" },
};

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, total, clear } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("ACH");
  const [payoutDetail, setPayoutDetail] = useState("");
  const [shippingOption, setShippingOption] = useState<ShippingOption>("PREPAID_LABEL");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promo, setPromo] = useState("");
  const [bonus, setBonus] = useState(0);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [instant, setInstant] = useState(false);
  const [ref, setRef] = useState<string | undefined>(undefined);
  useEffect(() => setRef(getStoredRef()), []);

  if (!mounted) return null;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Your box is empty</h1>
        <Link href="/sell" className="btn-primary mt-4">Sell a device</Link>
      </div>
    );
  }

  async function applyPromo() {
    setPromoMsg(null);
    if (!promo.trim()) return;
    const cats = [...new Set(lines.map((l) => l.category).filter(Boolean))] as string[];
    const v = await api.validatePromo(promo.trim(), "BUYBACK_BONUS", total(), cats);
    setBonus(v.valid ? v.amount : 0);
    setPromoMsg(v.description);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.createOrder({
        email,
        fullName,
        payoutMethod,
        payoutDetail,
        shippingOption,
        promoCode: promo.trim() || undefined,
        instantPayout: instant,
        affiliateCode: ref,
        items: lines.map((l) => ({ quoteId: l.quoteId })),
      });
      clear();
      router.push(`/track/${order.trackingId}?new=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
      setSubmitting(false);
    }
  }

  const valid = fullName && /.+@.+\..+/.test(email) && payoutDetail && agreed;

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>

        <Section title="Account">
          <Field label="Full name">
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </Section>

        <Section title="Payout method">
          <div className="grid grid-cols-2 gap-2">
            {PAYOUT_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setPayoutMethod(m)}
                className={`rounded-lg border p-3 text-sm font-medium ${
                  payoutMethod === m ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-gray-200"
                }`}
              >
                {PAYOUT_LABELS[m]}
              </button>
            ))}
          </div>
          <Field label={PAYOUT_DETAIL_LABEL[payoutMethod]}>
            <input className="input" value={payoutDetail} onChange={(e) => setPayoutDetail(e.target.value)} />
          </Field>
        </Section>

        <Section title="Shipping">
          <div className="space-y-2">
            {SHIPPING_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setShippingOption(s)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${
                  shippingOption === s ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-gray-200"
                }`}
              >
                <span className="text-sm font-medium">{SHIPPING_LABELS[s].label}</span>
                <span className="text-xs text-ink-500">{SHIPPING_LABELS[s].note}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Payout speed">
          <button
            onClick={() => setInstant((v) => !v)}
            className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${
              instant ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-gray-200"
            }`}
          >
            <span>
              <span className="block text-sm font-medium">⚡ Instant / same-day payout</span>
              <span className="block text-xs text-ink-500">
                Get paid the day we receive your device — fee {money(instantPayoutFee(total() + bonus))}
              </span>
            </span>
            <span className={`text-xs font-bold ${instant ? "text-brand-700" : "text-ink-300"}`}>
              {instant ? "ON" : "OFF"}
            </span>
          </button>
        </Section>

        <Section title="Terms">
          <label className="flex items-start gap-2 text-sm text-ink-500">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
            <span>
              I agree to the Fair-Evaluation Promise: if inspection adjusts my offer, I can accept or
              get my device shipped back free. Locked/ineligible devices may incur return shipping.
            </span>
          </label>
        </Section>

        {error && <p className="text-red-600">{error}</p>}

        <button className="btn-primary w-full" disabled={!valid || submitting} onClick={submit}>
          {submitting ? "Placing order…" : `Confirm trade-in · ${money(total() + bonus)}`}
        </button>
      </div>

      {/* Summary */}
      <aside className="card h-fit p-5">
        <h2 className="font-semibold">Your Box</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.quoteId} className="flex justify-between">
              <span className="text-ink-500">
                {l.modelName} <span className="text-ink-300">{l.variantLabel}</span>
              </span>
              <span className="font-medium">{money(l.offer, l.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex gap-2">
            <input className="input" placeholder="Promo code (try PHONE5)" value={promo} onChange={(e) => setPromo(e.target.value)} />
            <button className="btn-ghost" onClick={applyPromo}>Apply</button>
          </div>
          {promoMsg && <p className={`mt-1 text-xs ${bonus > 0 ? "text-brand-700" : "text-ink-500"}`}>{promoMsg}</p>}
        </div>

        <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-sm">
          <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{money(total())}</span></div>
          {bonus > 0 && (
            <div className="flex justify-between text-brand-700"><span>Promo bonus</span><span>+{money(bonus)}</span></div>
          )}
          {instant && (
            <div className="flex justify-between text-ink-500">
              <span>Instant payout fee</span><span>−{money(instantPayoutFee(total() + bonus))}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 font-bold">
            <span>You receive</span>
            <span className="text-brand-600">
              {money(total() + bonus - (instant ? instantPayoutFee(total() + bonus) : 0))}
            </span>
          </div>
        </div>

        {ref && (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
            Referred by <span className="font-semibold">{ref}</span> ✓
          </p>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RESALE_PAY_METHODS, type ResalePayMethod, type SaleDto } from "@sellme/shared";
import { useShopCart } from "@/lib/shop-cart";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function ShopCheckoutPage() {
  const { lines, total, clear } = useShopCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [payMethod, setPayMethod] = useState<ResalePayMethod>("CARD");
  const [promo, setPromo] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sale, setSale] = useState<SaleDto | null>(null);

  if (!mounted) return null;

  if (sale) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="card p-8">
          <p className="text-5xl">🎉</p>
          <h1 className="mt-3 text-2xl font-bold">Order confirmed</h1>
          <p className="mt-1 font-mono text-sm text-ink-500">{sale.reference}</p>
          <p className="mt-4 text-3xl font-extrabold text-brand-600">{money(sale.total, sale.currency)}</p>
          {sale.discount > 0 && <p className="text-sm text-brand-700">You saved {money(sale.discount)}</p>}
          <p className="mt-4 text-sm text-ink-500">A receipt is on its way to {sale.buyerEmail}.</p>
          <Link href="/shop" className="btn-primary mt-6">Keep shopping</Link>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link href="/shop" className="btn-primary mt-4">Browse stock</Link>
      </div>
    );
  }

  async function applyPromo() {
    setPromoMsg(null);
    if (!promo.trim()) return;
    const v = await api.validatePromo(promo.trim(), "RESALE_DISCOUNT", total(), []);
    setDiscount(v.valid ? v.amount : 0);
    setPromoMsg(v.description);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.resaleCheckout({
        buyerEmail,
        buyerName,
        payMethod,
        promoCode: promo.trim() || undefined,
        listingIds: lines.map((l) => l.listingId),
      });
      clear();
      setSale(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
      setSubmitting(false);
    }
  }

  const grandTotal = Math.max(0, total() - discount);
  const valid = buyerName && /.+@.+\..+/.test(buyerEmail);

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>

        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">Buyer</h2>
          <input className="input" placeholder="Full name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
          <input className="input" type="email" placeholder="Email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">Payment</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {RESALE_PAY_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className={`rounded-lg border p-3 text-sm font-medium ${
                  payMethod === m ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-gray-200"
                }`}
              >
                {m === "CARD" ? "💳 Card" : "PayPal"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-300">Payment is stubbed in this demo — no card is charged.</p>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={!valid || submitting} onClick={submit}>
          {submitting ? "Placing order…" : `Pay ${money(grandTotal)}`}
        </button>
      </div>

      <aside className="card h-fit p-5">
        <h2 className="font-semibold">Summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.listingId} className="flex justify-between">
              <span className="text-ink-500">{l.title.split(" · ")[0]}</span>
              <span className="font-medium">{money(l.price)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex gap-2">
            <input className="input" placeholder="Promo code" value={promo} onChange={(e) => setPromo(e.target.value)} />
            <button className="btn-ghost" onClick={applyPromo}>Apply</button>
          </div>
          {promoMsg && <p className={`mt-1 text-xs ${discount > 0 ? "text-brand-700" : "text-ink-500"}`}>{promoMsg}</p>}
        </div>

        <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-sm">
          <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{money(total())}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-brand-700"><span>Discount</span><span>−{money(discount)}</span></div>
          )}
          <div className="flex justify-between pt-1 font-bold"><span>Total</span><span className="text-brand-600">{money(grandTotal)}</span></div>
        </div>
      </aside>
    </div>
  );
}

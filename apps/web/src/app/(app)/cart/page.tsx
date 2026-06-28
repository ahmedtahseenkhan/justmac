"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { money, countdown } from "@/lib/format";

export default function CartPage() {
  const { lines, remove, total } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold tracking-tight">Your Box</h1>
      <p className="mt-2 text-ink-500">Devices you're trading in. Add as many as you like.</p>

      {lines.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-ink-500">Your box is empty.</p>
          <Link href="/sell" className="btn-primary mt-4">Sell a device</Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {lines.map((l) => (
              <li key={l.quoteId} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{l.modelName}</p>
                  <p className="text-sm text-ink-500">{l.variantLabel}</p>
                  <p className="mt-1 text-xs text-ink-300">🔒 Locked for {countdown(l.lockExpiresAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-brand-600">{money(l.offer, l.currency)}</p>
                  <button
                    onClick={() => remove(l.quoteId)}
                    className="text-xs font-semibold text-ink-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="card mt-6 flex items-center justify-between p-5">
            <span className="font-semibold">Total payout</span>
            <span className="text-2xl font-extrabold text-brand-600">{money(total())}</span>
          </div>

          <div className="mt-6 flex gap-3">
            <Link href="/sell" className="btn-ghost flex-1 text-center">Add more devices</Link>
            <Link href="/checkout" className="btn-primary flex-1 text-center">Checkout</Link>
          </div>
        </>
      )}
    </div>
  );
}

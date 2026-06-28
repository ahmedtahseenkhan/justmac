"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useShopCart } from "@/lib/shop-cart";
import { money } from "@/lib/format";

export default function ShopCartPage() {
  const { lines, remove, total } = useShopCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold tracking-tight">Your cart</h1>
      {lines.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-ink-500">Your cart is empty.</p>
          <Link href="/shop" className="btn-primary mt-4">Browse Certified Pre-Owned</Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {lines.map((l) => (
              <li key={l.listingId} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{l.title.split(" · ")[0]}</p>
                  <p className="text-xs text-ink-300">{l.sku} · Grade {l.grade}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-brand-600">{money(l.price)}</p>
                  <button onClick={() => remove(l.listingId)} className="text-xs font-semibold text-ink-500 hover:text-red-600">
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="card mt-6 flex items-center justify-between p-5">
            <span className="font-semibold">Subtotal</span>
            <span className="text-2xl font-extrabold text-brand-600">{money(total())}</span>
          </div>
          <Link href="/shop/checkout" className="btn-primary mt-6 w-full text-center">Checkout</Link>
        </>
      )}
    </div>
  );
}

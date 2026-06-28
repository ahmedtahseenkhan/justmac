"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingDto } from "@sellme/shared";
import { useShopCart } from "@/lib/shop-cart";
import { money } from "@/lib/format";

export function ListingDetail({ listing }: { listing: ListingDto }) {
  const router = useRouter();
  const add = useShopCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const sold = listing.status === "SOLD";

  function addToCart() {
    add({
      listingId: listing.id,
      sku: listing.sku,
      title: listing.title,
      price: listing.price,
      grade: listing.grade,
    });
    setAdded(true);
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
      <div className="card grid place-items-center p-10 text-7xl">📦</div>
      <div>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
          {listing.gradeLabel}
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{listing.title.split(" · ")[0]}</h1>
        <p className="mt-1 font-mono text-sm text-ink-300">{listing.sku}</p>
        <p className="mt-4 text-4xl font-extrabold text-brand-600">{money(listing.price, listing.currency)}</p>

        <ul className="mt-6 space-y-2 text-sm text-ink-500">
          <li>✓ {listing.warrantyMonths}-month warranty included</li>
          <li>✓ Professionally inspected &amp; graded</li>
          <li>✓ Securely data-wiped (NIST erase)</li>
          <li>✓ Fully traceable acquisition history</li>
        </ul>

        <div className="mt-8">
          {sold ? (
            <p className="rounded-lg bg-gray-100 px-4 py-3 text-center font-semibold text-ink-500">Sold</p>
          ) : added ? (
            <div className="flex gap-3">
              <button className="btn-primary flex-1" onClick={() => router.push("/shop/cart")}>
                Go to cart →
              </button>
              <button className="btn-ghost" onClick={() => router.push("/shop")}>Keep shopping</button>
            </div>
          ) : (
            <button className="btn-primary w-full" onClick={addToCart}>Add to cart</button>
          )}
        </div>
      </div>
    </div>
  );
}

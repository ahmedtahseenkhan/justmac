import Link from "next/link";
import { api } from "@/lib/api";
import { ListingCard } from "@/components/ListingCard";
import { FEATURES } from "@/lib/features";
import { ComingSoon } from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  if (!FEATURES.shop) {
    return (
      <ComingSoon
        title="Certified Pre-Owned store"
        blurb="Our refurbished, warrantied storefront is launching soon. For now, get an instant cash quote for your device."
      />
    );
  }
  const listings = await api.shop().catch(() => []);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Certified Pre-Owned</h1>
          <p className="mt-2 text-ink-500">
            Refurbished, data-wiped, and warrantied. Every unit traceable from trade-in to your door.
          </p>
        </div>
        <Link href="/shop/cart" className="btn-ghost">Cart</Link>
      </div>

      {listings.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-ink-500">
          <p>No refurbished stock listed yet.</p>
          <p className="mt-1 text-sm">
            Acquire a device through the trade-in flow, take it to <Link href="/ops/resale" className="underline">ops → resale</Link>, and list it.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}

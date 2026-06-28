import Link from "next/link";
import type { ListingDto } from "@sellme/shared";
import { money } from "@/lib/format";

const GRADE_COLOR: Record<string, string> = {
  A: "bg-brand-100 text-brand-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-gray-200 text-ink-700",
};

export function ListingCard({ listing }: { listing: ListingDto }) {
  return (
    <Link
      href={`/shop/${listing.sku}`}
      className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-4 grid h-28 place-items-center rounded-xl bg-gray-100 text-4xl">📦</div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${GRADE_COLOR[listing.grade]}`}>
          {listing.gradeLabel}
        </span>
      </div>
      <p className="mt-2 font-semibold text-ink-900">{listing.title.split(" · ")[0]}</p>
      <p className="text-sm text-ink-500">{listing.warrantyMonths}-month warranty · Certified</p>
      <p className="mt-3 text-2xl font-extrabold text-brand-600">{money(listing.price, listing.currency)}</p>
      <span className="mt-2 text-sm font-semibold text-brand-700 group-hover:underline">View →</span>
    </Link>
  );
}

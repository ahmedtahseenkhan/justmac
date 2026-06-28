import Link from "next/link";
import type { ModelCardDto } from "@sellme/shared";
import { money } from "@/lib/format";

export function ModelCard({ model }: { model: ModelCardDto }) {
  return (
    <Link
      href={`/sell/${model.slug}`}
      className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-4 grid h-28 place-items-center rounded-xl bg-gray-100 text-4xl">
        📱
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-300">{model.brand}</p>
      <p className="font-semibold text-ink-900">{model.name}</p>
      <p className="mt-3 text-sm text-ink-500">Cash up to</p>
      <p className="text-2xl font-extrabold text-brand-600">{money(model.cashUpTo)}</p>
      <span className="mt-3 text-sm font-semibold text-brand-700 group-hover:underline">
        Get my quote →
      </span>
    </Link>
  );
}

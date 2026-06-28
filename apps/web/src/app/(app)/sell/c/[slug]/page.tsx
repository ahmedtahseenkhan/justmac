import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { SellCatalog } from "../../SellCatalog";

export const dynamic = "force-dynamic";

export default async function SellCategoryPage({ params }: { params: { slug: string } }) {
  const [categories, models] = await Promise.all([
    api.listCategories().catch(() => []),
    api.listModels(undefined, params.slug).catch(() => []),
  ]);
  const category = categories.find((c) => c.slug === params.slug);
  if (!category) notFound();

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-ink-400">
        <Link href="/sell" className="hover:text-brand-700">Sell</Link>
        <span>/</span>
        <span className="font-medium text-ink-900">{category.name}</span>
      </nav>

      <header className="mt-4 text-center">
        <div className="eyebrow">Get an instant offer</div>
        <h1 className="mt-2 font-display text-[clamp(30px,4.5vw,48px)] font-extrabold tracking-[-0.03em]">
          Sell your {category.name}
        </h1>
        <p className="mt-3 text-ink-500">{models.length} models · pick yours for a transparent cash quote.</p>
      </header>

      <SellCatalog initial={models} showCategories={false} />
    </div>
  );
}

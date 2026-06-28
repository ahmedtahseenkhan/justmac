import { api } from "@/lib/api";
import { SellHome } from "./SellHome";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const [categories, models] = await Promise.all([
    api.listCategories().catch(() => []),
    api.listModels().catch(() => []),
  ]);
  return <SellHome categories={categories} models={models} />;
}

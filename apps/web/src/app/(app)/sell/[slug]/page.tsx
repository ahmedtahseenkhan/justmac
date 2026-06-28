import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { QuoteWizard } from "./QuoteWizard";

export const dynamic = "force-dynamic";

export default async function ModelPage({ params }: { params: { slug: string } }) {
  const model = await api.getModel(params.slug).catch(() => null);
  if (!model) notFound();
  return <QuoteWizard model={model} />;
}

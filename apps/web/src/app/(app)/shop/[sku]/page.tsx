import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { ListingDetail } from "./ListingDetail";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: { sku: string } }) {
  const listing = await api.getListing(params.sku).catch(() => null);
  if (!listing) notFound();
  return <ListingDetail listing={listing} />;
}

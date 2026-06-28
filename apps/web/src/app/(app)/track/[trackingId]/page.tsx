import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { OrderTrack } from "@/components/OrderTrack";

export const dynamic = "force-dynamic";

export default async function TrackOrderPage({
  params,
  searchParams,
}: {
  params: { trackingId: string };
  searchParams: { new?: string };
}) {
  const order = await api.trackOrder(params.trackingId).catch(() => null);
  if (!order) notFound();
  return <OrderTrack order={order} justPlaced={searchParams.new === "1"} />;
}

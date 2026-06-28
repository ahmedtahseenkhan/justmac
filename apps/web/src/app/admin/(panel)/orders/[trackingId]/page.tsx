import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { OrderTrack } from "@/components/OrderTrack";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: { trackingId: string } }) {
  const order = await api.trackOrder(params.trackingId).catch(() => null);
  if (!order) notFound();
  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="text-sm font-semibold text-brand-700 hover:underline">
        ← All orders
      </Link>
      <OrderTrack order={order} justPlaced={false} />
    </div>
  );
}

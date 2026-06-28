import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { BatchDevices } from "@/components/BatchDevices";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: { reference: string } }) {
  const batch = await api.getBatch(params.reference).catch(() => null);
  if (!batch) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/b2b" className="text-sm font-semibold text-brand-700 hover:underline">
        ← All batches
      </Link>
      <h1 className="mt-2 font-mono text-2xl font-extrabold">{batch.reference}</h1>
      <p className="text-ink-500">
        {batch.company} · {batch.contactName} · {batch.type} · routed to {batch.manager}
      </p>

      {batch.invoice && (
        <div className="card mt-4 flex items-center justify-between p-5">
          <div>
            <p className="font-semibold">Invoice {batch.invoice.number}</p>
            <p className="text-sm text-ink-500">
              Net-{batch.invoice.netTermsDays} · due {batch.invoice.dueDate.slice(0, 10)} · {batch.invoice.status}
            </p>
          </div>
          <p className="text-2xl font-extrabold text-brand-600">{money(batch.invoice.amount)}</p>
        </div>
      )}

      <BatchDevices batch={batch} />
    </div>
  );
}

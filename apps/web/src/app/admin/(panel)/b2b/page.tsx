import Link from "next/link";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const batches = await api.listBatches().catch(() => []);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">B2B batches</h1>
          <p className="mt-2 text-ink-500">Relationship-manager dashboard.</p>
        </div>
        <Link href="/b2b" className="btn-primary">New batch (public intake)</Link>
      </div>

      {batches.length === 0 ? (
        <p className="card mt-6 p-6 text-ink-500">No batches yet. Submit one from the B2B intake.</p>
      ) : (
        <div className="card mt-6 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-ink-300">
                <th className="p-3 font-medium">Reference</th>
                <th className="p-3 font-medium">Company</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 text-right font-medium">Devices</th>
                <th className="p-3 text-right font-medium">Value</th>
                <th className="p-3 font-medium">Manager</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="p-3">
                    <Link href={`/admin/b2b/${b.reference}`} className="font-mono font-semibold text-brand-700 hover:underline">
                      {b.reference}
                    </Link>
                  </td>
                  <td className="p-3">{b.company}</td>
                  <td className="p-3">{b.type}</td>
                  <td className="p-3 text-right">
                    {b.deviceCount}
                    {b.matchedCount < b.deviceCount && (
                      <span className="ml-1 text-xs text-amber-600">({b.matchedCount} matched)</span>
                    )}
                  </td>
                  <td className="p-3 text-right">{b.type === "BUYBACK" ? money(b.totalValue) : "—"}</td>
                  <td className="p-3 text-ink-500">{b.manager}</td>
                  <td className="p-3">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

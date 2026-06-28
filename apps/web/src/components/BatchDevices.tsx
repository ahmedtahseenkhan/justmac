import type { BatchDto } from "@sellme/shared";
import { money } from "@/lib/format";

export function BatchDevices({ batch }: { batch: BatchDto }) {
  return (
    <div className="card mt-6 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-ink-300">
            <th className="p-3 font-medium">Device</th>
            <th className="p-3 font-medium">Serial</th>
            {batch.type === "BUYBACK" && <th className="p-3 text-right font-medium">Value</th>}
            <th className="p-3 font-medium">Certificates</th>
            <th className="p-3 font-medium">Chain of custody</th>
          </tr>
        </thead>
        <tbody>
          {batch.devices.map((d) => (
            <tr key={d.id} className="border-b border-gray-50 align-top last:border-0">
              <td className="p-3">
                {d.modelName} <span className="text-ink-300">{d.variantLabel}</span>
                {!d.matched && <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-700">unmatched</span>}
              </td>
              <td className="p-3 font-mono text-xs">{d.serial ?? "—"}</td>
              {batch.type === "BUYBACK" && (
                <td className="p-3 text-right font-medium">{d.matched ? money(d.quotedValue) : "—"}</td>
              )}
              <td className="p-3 text-xs">
                <span className="text-brand-700">✓ wipe</span>
                {d.destructionCertUrl && <span className="ml-2 text-brand-700">✓ destruction</span>}
              </td>
              <td className="p-3 text-xs text-ink-500">{d.custody.map((c) => c.event).join(" → ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

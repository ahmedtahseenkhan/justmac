"use client";

import { useEffect, useState } from "react";
import type { BreakdownLine } from "@sellme/shared";
import { money, countdown } from "@/lib/format";

const KIND_STYLES: Record<BreakdownLine["kind"], string> = {
  base: "text-ink-900 font-semibold",
  market: "text-ink-500",
  depreciation: "text-ink-500",
  condition: "text-ink-500",
  margin: "text-ink-500",
  guardrail: "text-brand-700",
};

/** The transparency differentiator: shows exactly how the offer was built. */
export function PriceBreakdown({
  breakdown,
  currency,
  lockExpiresAt,
}: {
  breakdown: BreakdownLine[];
  currency: string;
  lockExpiresAt: string;
}) {
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mt-6 rounded-xl border border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
      >
        <span>How we got this price</span>
        <span className="text-ink-300">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          <table className="w-full text-sm">
            <tbody>
              {breakdown.map((line, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className={`py-1.5 ${KIND_STYLES[line.kind]}`}>{line.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink-500">
                    {line.amount >= 0 ? "+" : "−"}
                    {money(Math.abs(line.amount), currency)}
                  </td>
                  <td className="py-1.5 pl-4 text-right font-medium tabular-nums">
                    {money(line.runningTotal, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-ink-500">
        <span>🔒 Quote locked for {countdown(lockExpiresAt)}</span>
        <span>Re-evaluated at market value after expiry</span>
      </div>
    </div>
  );
}

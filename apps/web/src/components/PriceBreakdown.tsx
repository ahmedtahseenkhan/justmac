"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/format";

/**
 * Quote-lock bar shown under the offer. The line-by-line price breakdown was
 * removed from the customer view (it confused sellers) — staff still see the
 * full breakdown in the admin Pricing console's simulator.
 */
export function PriceBreakdown({ lockExpiresAt }: { lockExpiresAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-ink-500">
      <span>🔒 Quote locked for {countdown(lockExpiresAt)}</span>
      <span>Re-evaluated at market value after expiry</span>
    </div>
  );
}

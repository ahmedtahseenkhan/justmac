"use client";

// Shared pieces for the Market prices section (Review queue / Products / Settings).

import { useCallback, useEffect, useState } from "react";
import type { MarketOverviewDto, MarketSource, TierPrices } from "@sellme/shared";
import { MARKET_SOURCE_LABELS } from "@sellme/shared";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export function useMarketOverview() {
  const [data, setData] = useState<MarketOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await api.marketOverview());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, refresh };
}

const SOURCE_STYLES: Record<MarketSource, string> = {
  BACKMARKET: "bg-violet-100 text-violet-700",
  GAZELLE: "bg-sky-100 text-sky-700",
  PLUG: "bg-teal-100 text-teal-700",
};

export function SourceBadge({ source }: { source: MarketSource }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SOURCE_STYLES[source]}`}>
      {MARKET_SOURCE_LABELS[source]}
    </span>
  );
}

export function TierChips({ tiers, currency }: { tiers: TierPrices; currency?: string }) {
  const order = ["fair", "good", "great", "excellent", "premium"];
  const entries = Object.entries(tiers).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  if (entries.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {entries.map(([tier, price]) => (
        <span
          key={tier}
          className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-700"
          title={`${tier} condition on the marketplace`}
        >
          {tier.slice(0, 1).toUpperCase()}
          {tier.slice(1, 4)} {money(price, currency)}
        </span>
      ))}
    </span>
  );
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

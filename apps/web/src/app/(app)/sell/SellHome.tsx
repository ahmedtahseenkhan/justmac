"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ModelCardDto } from "@sellme/shared";
import type { CategoryStat } from "@/lib/api";
import { DeviceTile } from "@/components/DeviceTile";
import { DeviceArt, deviceKind } from "@/components/DeviceArt";

const PANELS = [
  { bg: "linear-gradient(155deg,#E9F0FB,#F5F9FE)", tint: "#9DB8E0" },
  { bg: "linear-gradient(155deg,#EDF0FB,#F6F8FD)", tint: "#A9C6EE" },
  { bg: "linear-gradient(155deg,#ECEFF8,#F6F7FC)", tint: "#9FB3D8" },
  { bg: "linear-gradient(155deg,#EFF1F4,#F8F9FB)", tint: "#CDD3DA" },
  { bg: "linear-gradient(155deg,#E6F1FA,#F4FAFE)", tint: "#8FC3E6" },
];

export function SellHome({ categories, models }: { categories: CategoryStat[]; models: ModelCardDto[] }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim().toLowerCase()), 120);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => {
    if (!debounced) return [];
    const terms = debounced.split(/\s+/);
    return models
      .filter((m) => terms.every((t) => `${m.brand} ${m.name} ${m.category}`.toLowerCase().includes(t)))
      .slice(0, 24);
  }, [debounced, models]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 -top-10 z-0 mx-auto h-[320px] max-w-3xl bg-[radial-gradient(60%_60%_at_50%_0%,rgba(28,160,221,.16),transparent_70%)]" />

      <header className="relative z-[1] text-center">
        <div className="eyebrow">Get an instant offer</div>
        <h1 className="mx-auto mt-3 max-w-2xl font-display text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.02] tracking-[-0.03em]">
          What are you selling?
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-ink-500">
          Pick a category or search your exact Apple device for a transparent cash quote.
        </p>

        {/* Search */}
        <div className="relative mx-auto mt-8 max-w-2xl">
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-300"><SearchIcon /></span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search “iPhone 15 Pro”, “MacBook Air M3”, “iPad mini”…"
            aria-label="Search devices"
            className="w-full rounded-2xl border border-line bg-white py-4 pl-[52px] pr-5 text-base shadow-[0_18px_50px_-30px_rgba(11,20,16,.5)] outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-2 text-ink-300 hover:text-ink-700">✕</button>
          )}
        </div>

        {/* Quick links */}
        {!debounced && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-sm">
            <span className="font-medium text-ink-400">Quick links:</span>
            {categories.map((c) => (
              <Link key={c.slug} href={`/sell/c/${c.slug}`} className="rounded-full border border-line bg-white px-4 py-2 font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                Sell {c.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Search results OR category grid */}
      <div className="relative z-[1] mt-10">
        {debounced ? (
          results.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center text-ink-400">
              No match for “{q.trim()}”. Try a model name like “iPhone 14” or “MacBook Air”.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-ink-400">{results.length} match{results.length === 1 ? "" : "es"} for “{q.trim()}”</p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((m, i) => <DeviceTile key={m.id} model={m} index={i} />)}
              </div>
            </>
          )
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c, i) => {
              const panel = PANELS[i % PANELS.length];
              return (
                <Link key={c.slug} href={`/sell/c/${c.slug}`} className="card group flex items-center gap-5 p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                  <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl" style={{ background: panel.bg }}>
                    <DeviceArt kind={deviceKind(c.name)} tint={panel.tint} />
                  </div>
                  <div>
                    <div className="font-display text-xl font-extrabold tracking-[-0.01em]">Sell {c.name}</div>
                    <div className="mt-0.5 text-sm text-ink-400">{c.modelCount} model{c.modelCount === 1 ? "" : "s"}</div>
                    <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                      Browse <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

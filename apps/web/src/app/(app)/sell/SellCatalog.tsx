"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModelCardDto } from "@sellme/shared";
import { DeviceTile } from "@/components/DeviceTile";

/**
 * Client-side type-ahead + category filter over the catalog. Filters the initial
 * server payload instantly; production would hit a hosted search engine (Typesense/Algolia).
 */
export function SellCatalog({ initial, showCategories = true }: { initial: ModelCardDto[]; showCategories?: boolean }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cat, setCat] = useState("All");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim().toLowerCase()), 120);
    return () => clearTimeout(t);
  }, [q]);

  const categories = useMemo(() => {
    const set = new Set(initial.map((m) => m.category));
    return ["All", ...Array.from(set).sort()];
  }, [initial]);

  const results = useMemo(() => {
    return initial.filter((m) => {
      if (cat !== "All" && m.category !== cat) return false;
      if (!debounced) return true;
      const hay = `${m.brand} ${m.name}`.toLowerCase();
      return debounced.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [debounced, cat, initial]);

  return (
    <div>
      {/* Search */}
      <div className="relative mx-auto mt-8 max-w-2xl">
        <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-300">
          <SearchIcon />
        </span>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search “iPhone 15 Pro”, “MacBook Air”, “iPad”…"
          aria-label="Search devices"
          className="w-full rounded-2xl border border-line bg-white py-4 pl-[52px] pr-5 text-base shadow-[0_18px_50px_-30px_rgba(11,20,16,.5)] outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-2 text-ink-300 hover:text-ink-700"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category chips */}
      {showCategories && (
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                cat === c
                  ? "border-brand-600 bg-brand-600 text-white shadow-[0_10px_22px_-12px_rgba(28,95,182,.8)]"
                  : "border-line bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {c === "All" ? "All devices" : c}
            </button>
          ))}
        </div>
      )}

      {/* Result count */}
      <p className="mt-8 text-sm text-ink-400">
        {results.length} {results.length === 1 ? "device" : "devices"}
        {cat !== "All" && <> in {cat}</>}
        {debounced && <> matching “{q.trim()}”</>}
      </p>

      {/* Grid */}
      {results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
            <SearchIcon />
          </div>
          <p className="mt-4 font-display text-lg font-bold">No match for “{q.trim()}”</p>
          <p className="mt-1 text-ink-400">Try another model, or clear your filters.</p>
          <button
            onClick={() => {
              setQ("");
              setCat("All");
            }}
            className="btn-ghost mt-5"
          >
            Reset
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((m, i) => (
            <DeviceTile key={m.id} model={m} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

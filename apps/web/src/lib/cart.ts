"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A line in "Your Box" — references a server-locked quote snapshot. */
export interface CartLine {
  quoteId: string;
  modelName: string;
  variantLabel: string;
  offer: number;
  currency: string;
  lockExpiresAt: string;
  /** Category slug (best-effort) — lets checkout preview category-scoped promos. */
  category?: string;
}

interface CartState {
  lines: CartLine[];
  add: (line: CartLine) => void;
  remove: (quoteId: string) => void;
  clear: () => void;
  total: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line) =>
        set((s) =>
          s.lines.some((l) => l.quoteId === line.quoteId)
            ? s
            : { lines: [...s.lines, line] },
        ),
      remove: (quoteId) => set((s) => ({ lines: s.lines.filter((l) => l.quoteId !== quoteId) })),
      clear: () => set({ lines: [] }),
      total: () => get().lines.reduce((sum, l) => sum + l.offer, 0),
    }),
    { name: "sellme-box" },
  ),
);

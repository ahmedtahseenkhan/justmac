"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ShopLine {
  listingId: string;
  sku: string;
  title: string;
  price: number;
  grade: string;
}

interface ShopCartState {
  lines: ShopLine[];
  add: (line: ShopLine) => void;
  remove: (listingId: string) => void;
  clear: () => void;
  total: () => number;
}

export const useShopCart = create<ShopCartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line) =>
        set((s) =>
          s.lines.some((l) => l.listingId === line.listingId) ? s : { lines: [...s.lines, line] },
        ),
      remove: (listingId) => set((s) => ({ lines: s.lines.filter((l) => l.listingId !== listingId) })),
      clear: () => set({ lines: [] }),
      total: () => get().lines.reduce((sum, l) => sum + l.price, 0),
    }),
    { name: "sellme-shop-cart" },
  ),
);

"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

const KEY = "sellme-ref";

/** Captures ?ref=CODE from any landing URL, stores it, and tracks the click. */
export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      const code = ref.trim().toUpperCase();
      localStorage.setItem(KEY, code);
      api.affiliateClick(code).catch(() => undefined);
    }
  }, []);
  return null;
}

export function getStoredRef(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(KEY) ?? undefined;
}

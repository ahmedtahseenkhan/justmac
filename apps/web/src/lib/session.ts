"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@sellme/shared";

const COOKIE = "jm_session";

interface SessionState {
  user: AuthUser | null;
  token: string | null;
  setSession: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
}

/** Writes the JWT to a JS-readable cookie so middleware + the API client can see it. */
function writeCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `${COOKIE}=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  } else {
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setSession: (token, user) => {
        writeCookie(token);
        set({ token, user });
      },
      // Set the user without touching the auth cookie (used when hydrating from /auth/me).
      setUser: (user) => set({ user }),
      clear: () => {
        writeCookie(null);
        set({ token: null, user: null });
      },
    }),
    { name: "jm-session" },
  ),
);

/** Read the bearer token for API calls (client-side). */
export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  if (match) return decodeURIComponent(match[1]);
  return useSession.getState().token;
}

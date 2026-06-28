"use client";

import type { Role } from "@sellme/shared";
import { useSession } from "@/lib/session";

/** Client-side role gate for ADMIN-only pages (defense-in-depth with the API guards). */
export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const user = useSession((s) => s.user);
  if (user && user.role !== role) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-3xl">🔒</p>
        <h1 className="mt-2 font-display text-xl font-bold">Admin access only</h1>
        <p className="mt-1 text-ink-500">Your account ({user.role.toLowerCase()}) can't view this section.</p>
      </div>
    );
  }
  return <>{children}</>;
}

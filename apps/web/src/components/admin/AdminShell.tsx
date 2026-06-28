"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role } from "@sellme/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { FEATURES } from "@/lib/features";

type NavItem = { href: string; label: string; icon: string; roles?: Role[]; enabled?: boolean };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Operate",
    items: [
      { href: "/admin", label: "Dashboard", icon: "▦" },
      { href: "/admin/orders", label: "Orders", icon: "🧾" },
      { href: "/admin/operations", label: "Grading queue", icon: "🔧" },
      { href: "/admin/resale", label: "Resale", icon: "📦", enabled: FEATURES.shop },
      { href: "/admin/b2b", label: "Business / ITAD", icon: "🏢", enabled: FEATURES.business },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/admin/catalog", label: "Catalog", icon: "📱", roles: ["ADMIN"] },
      { href: "/admin/pricing", label: "Pricing", icon: "＄", roles: ["ADMIN"] },
      { href: "/admin/promos", label: "Promo codes", icon: "🏷️", roles: ["ADMIN"] },
      { href: "/admin/affiliates", label: "Affiliates", icon: "🔗", roles: ["ADMIN"] },
      { href: "/admin/price-watch", label: "Price watch", icon: "🔔", roles: ["ADMIN"] },
      { href: "/admin/users", label: "Staff & roles", icon: "👤", roles: ["ADMIN"] },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, clear } = useSession();
  const [ready, setReady] = useState(false);

  // Hydrate the user from the cookie/JWT if the store is empty (e.g. after refresh).
  // Use setUser so we never overwrite the auth cookie here.
  useEffect(() => {
    let active = true;
    (async () => {
      if (user) {
        setReady(true);
        return;
      }
      try {
        const me = await api.me();
        if (active) setUser(me);
      } catch {
        clear();
        router.replace("/admin/login");
        return;
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clear();
    router.replace("/admin/login");
  }

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-ink-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-brand-900 text-white lg:flex">
        <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5">
          <Logo size={32} />
          <span className="font-display text-lg font-extrabold">JustMac</span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">Admin</span>
        </Link>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {NAV.map((group) => {
            const items = group.items.filter((i) => i.enabled !== false && (!i.roles || i.roles.includes(user.role)));
            if (items.length === 0) return null;
            return (
              <div key={group.section}>
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  {group.section}
                </p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="w-5 text-center text-base">{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <Link href="/" className="px-5 py-4 text-xs text-white/50 hover:text-white/80">
          ← Back to storefront
        </Link>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white/90 px-5 py-3 backdrop-blur sm:px-8">
          <MobileNav role={user.role} pathname={pathname} />
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <p className="text-[11px] text-ink-400">{user.email}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                user.role === "ADMIN" ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-ink-700"
              }`}
            >
              {user.role === "ADMIN" ? "Admin" : "Staff"}
            </span>
            <button onClick={logout} className="btn-ghost px-3 py-2 text-sm">Logout</button>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

function MobileNav({ role, pathname }: { role: Role; pathname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-3 py-2 text-sm" aria-label="Menu">
        ☰ Menu
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-60 rounded-xl border border-line bg-white p-2 shadow-lg">
          {NAV.flatMap((g) => g.items)
            .filter((i) => i.enabled !== false && (!i.roles || i.roles.includes(role)))
            .map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  pathname.startsWith(i.href) && i.href !== "/admin" ? "bg-brand-50 text-brand-700" : "text-ink-700"
                }`}
              >
                {i.label}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

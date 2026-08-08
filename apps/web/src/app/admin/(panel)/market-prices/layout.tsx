"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/market-prices", label: "Review queue" },
  { href: "/admin/market-prices/products", label: "Products" },
  { href: "/admin/market-prices/settings", label: "Settings" },
];

export default function MarketPricesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Market prices</h1>
        <p className="mt-1 text-ink-500">
          Automatic price feed from Back Market, Gazelle, and plug.tech — the sync matches products,
          pulls prices, and staff approve what lands in the review queue.
        </p>
      </div>

      <nav className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active =
            t.href === "/admin/market-prices" ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border border-b-0 border-line bg-white text-brand-700"
                  : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

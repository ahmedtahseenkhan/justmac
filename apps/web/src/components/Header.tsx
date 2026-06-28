"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { Logo } from "@/components/Logo";
import { FEATURES } from "@/lib/features";

const NAV = [
  { href: "/sell", label: "Sell a device", enabled: true },
  { href: "/shop", label: "Shop", enabled: FEATURES.shop },
  { href: "/b2b", label: "Business", enabled: FEATURES.business },
  { href: "/track", label: "Track", enabled: true },
];

export function Header() {
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background,box-shadow] duration-300 ${
        scrolled
          ? "bg-canvas/80 shadow-[0_1px_0_rgba(11,20,16,.06),0_18px_40px_-28px_rgba(11,20,16,.45)] backdrop-blur-lg backdrop-saturate-150"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-page items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="drop-shadow-[0_6px_12px_rgba(28,95,182,.4)]">
            <Logo size={40} />
          </span>
          <span className="font-display text-[22px] font-extrabold tracking-[-0.02em]">JustMac</span>
        </Link>

        <nav className="hidden items-center gap-7 text-[15px] font-medium text-ink-700 lg:flex">
          {NAV.map((n) =>
            n.enabled ? (
              <Link key={n.href} href={n.href} className="navlink">
                {n.label}
              </Link>
            ) : (
              <span key={n.href} className="flex cursor-default items-center gap-1.5 text-ink-300" title="Coming soon">
                {n.label}
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">Soon</span>
              </span>
            ),
          )}
          <Link href="/cart" className="navlink relative">
            Your Box
            {mounted && lines.length > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white">
                {lines.length}
              </span>
            )}
          </Link>
        </nav>

        <Link href="/sell" className="btn-dark hidden text-[14.5px] sm:inline-flex">
          Get my quote
        </Link>
      </div>
    </header>
  );
}

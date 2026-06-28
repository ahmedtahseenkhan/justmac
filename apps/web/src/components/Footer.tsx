import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FEATURES } from "@/lib/features";

type FLink = { label: string; href: string; soon?: boolean };
const COLS: { head: string; links: FLink[] }[] = [
  {
    head: "Sell",
    links: [
      { label: "Sell a device", href: "/sell" },
      { label: "Get a quote", href: "/sell" },
      { label: "Track a trade-in", href: "/track" },
      { label: "Bulk & business", href: "/b2b", soon: !FEATURES.business },
    ],
  },
  {
    head: "Company",
    links: [
      { label: "Shop refurbished", href: "/shop", soon: !FEATURES.shop },
      { label: "Asset disposition", href: "/b2b", soon: !FEATURES.business },
      { label: "Track a trade-in", href: "/track" },
      { label: "Staff login", href: "/admin/login" },
    ],
  },
  {
    head: "Legal",
    links: [
      { label: "Privacy policy", href: "#" },
      { label: "Terms & conditions", href: "#" },
      { label: "Cookie policy", href: "#" },
      { label: "Accessibility", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-brand-900 px-5 pb-9 pt-14 text-white/70 sm:px-8">
      <div className="mx-auto grid max-w-page gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-4 flex items-center gap-2.5">
            <Logo size={38} />
            <span className="font-display text-xl font-extrabold text-white">JustMac</span>
          </div>
          <p className="mb-5 max-w-[280px] text-[14.5px] leading-relaxed">
            Instant quotes, free prepaid shipping, and our Fair-Evaluation Promise: reject an
            adjusted offer and we ship your device back free.
          </p>
          <form className="flex max-w-[300px] gap-2">
            <input
              placeholder="Email for resale & savings tips"
              className="flex-1 rounded-[10px] border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
            />
            <button
              type="button"
              className="flex items-center rounded-[10px] bg-brand-600 px-4 text-sm font-semibold text-white"
            >
              Join
            </button>
          </form>
        </div>

        {COLS.map((col) => (
          <div key={col.head}>
            <div className="mb-4 font-display text-sm font-bold text-white">{col.head}</div>
            <div className="flex flex-col gap-2.5">
              {col.links.map((l) =>
                l.soon ? (
                  <span key={l.label} className="flex w-fit items-center gap-1.5 text-[14.5px] text-white/35">
                    {l.label}
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Soon</span>
                  </span>
                ) : (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="w-fit text-[14.5px] text-white/60 transition-colors hover:text-brand-400"
                  >
                    {l.label}
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-11 flex max-w-page flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-white/50">
        <span>© 2026 JustMac — Demo build, not a real buyback service.</span>
        <span>Smart tech. Smarter savings.</span>
      </div>
    </footer>
  );
}

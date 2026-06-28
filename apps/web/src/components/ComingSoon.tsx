import Link from "next/link";

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-[13px] font-semibold text-brand-700">
        <span className="h-2 w-2 animate-pulsering rounded-full bg-brand-600" />
        Coming soon
      </span>
      <h1 className="mt-5 font-display text-[clamp(30px,5vw,44px)] font-extrabold tracking-[-0.03em]">{title}</h1>
      <p className="mt-3 text-ink-500">{blurb}</p>
      <Link href="/sell" className="btn-primary mt-7">Sell a device instead →</Link>
    </div>
  );
}

import Link from "next/link";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { Reveal, CountUp, Tilt } from "@/components/motion";
import { Faq } from "@/components/Faq";
import { DeviceVisual, deviceKind } from "@/components/DeviceArt";
import { SiteChrome } from "@/components/SiteChrome";

export const dynamic = "force-dynamic";

const PRESS = ["USA TODAY", "CNET", "Forbes", "WIRED", "TechCrunch", "CNBC", "Mashable", "PCWorld", "The Verge"];
const DEVICE_MQ = ["iPhone 15 Pro", "MacBook Air M3", "iPad Pro", "Apple Watch Ultra", "iPhone 14", "MacBook Pro", "iPad Air", "Apple Watch SE", "iPhone 13", "iPhone SE"];

const STEPS = [
  { n: "1", title: "Get an instant quote", desc: "Answer a few quick questions about your device's condition and see a full, transparent price breakdown instantly." },
  { n: "2", title: "Ship it free", desc: "We send a prepaid, trackable label or a shipping kit. Pack it up, drop it off, and track it the whole way." },
  { n: "3", title: "Get paid", desc: "We inspect, confirm, and pay via ACH, PayPal, check, or Zelle — usually within a couple of days." },
];

type Why = {
  icon: string;
  value?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  static?: string;
  unit: string;
  label: string;
  desc: string;
};
const WHYUS: Why[] = [
  { icon: "star", value: 20000, suffix: "+", unit: "", label: "Reviews", desc: "Real customers, real payouts — read them yourself." },
  { icon: "shield", static: "A+", unit: "", label: "BBB Rating", desc: "Accredited with the Better Business Bureau." },
  { icon: "bolt", static: "1–2", unit: "days", label: "We Pay Fast", desc: "Payment sent the moment we finish inspection." },
  { icon: "trend", value: 18, prefix: "+", suffix: "%", unit: "", label: "Higher Offer", desc: "Our quote tends to beat the competition." },
  { icon: "award", value: 4.91, decimals: 2, unit: "/5", label: "Elite Rating", desc: "A top score on ResellerRatings." },
  { icon: "cast", static: "Top 1%", unit: "", label: "Industry trust", desc: "Featured by CNET, Forbes & WIRED." },
];

const REVIEWS = [
  { initial: "L", name: "Lara", place: "Fort Myers, FL", av: "#1C5FB6", quote: "Highly recommend JustMac. Easy to complete the sale and I got far better value than any other offer. Communication was clear the whole way." },
  { initial: "R", name: "Robert", place: "Carmel, IN", av: "#15498F", quote: "Very clear, very simple. The offer was confirmed on receipt and payment was made promptly — about $150 more than the trade-in I almost used." },
  { initial: "K", name: "Kassandra", place: "Irvine, CA", av: "#154C92", quote: "Honest assessment, prepaid label printed for me, and they emailed the moment my phone arrived. Smooth from start to finish." },
];

const TINTS = ["#9DB8E0", "#A9C6EE", "#9FB3D8", "#CDD3DA"];

export default async function HomePage() {
  const models = (await api.listModels().catch(() => [])).slice(0, 4);

  return (
    <SiteChrome fullBleed>
      {/* ---------- Hero ---------- */}
      <header className="relative px-5 pb-16 pt-9 sm:px-8 sm:pb-24 sm:pt-14">
        <div className="pointer-events-none absolute inset-[-18%_-10%] z-0 animate-aurora bg-[radial-gradient(38%_42%_at_28%_30%,rgba(28,160,221,.18),transparent_60%),radial-gradient(40%_48%_at_76%_38%,rgba(91,194,239,.16),transparent_62%)]" />
        <div className="pointer-events-none absolute right-[8%] top-[-50px] z-0 hidden h-[480px] w-[480px] animate-glowmove rounded-full bg-[radial-gradient(circle_at_42%_42%,rgba(91,194,239,.4),transparent_66%)] blur-2xl md:block" />

        <div className="relative z-[2] mx-auto grid max-w-page items-center gap-10 lg:grid-cols-[1.04fr_.96fr] lg:gap-16">
          <div className="max-w-[560px]">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-[13.5px] font-semibold text-brand-700">
                <span className="h-[7px] w-[7px] animate-pulsering rounded-full bg-brand-600" />
                Transparent quotes · No surprises
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-5 font-display text-[clamp(44px,5.6vw,76px)] font-extrabold leading-[.98] tracking-[-0.035em]">
                Turn your old phone into <span className="cashword">cash.</span>
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-6 max-w-[460px] text-[clamp(16px,1.5vw,19px)] leading-relaxed text-ink-600">
                Get an instant quote with a full price breakdown, ship free with a prepaid label, and
                get paid after a quick inspection.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="mt-8 flex flex-wrap gap-3.5">
                <Link
                  href="/sell"
                  className="relative inline-flex items-center gap-2 overflow-hidden rounded-[13px] bg-brand-600 px-7 py-4 text-base font-bold text-white shadow-[0_16px_34px_-14px_rgba(28,95,182,.7)]"
                >
                  <span className="absolute inset-0 animate-marquee bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,.35)_50%,transparent_80%)] bg-[length:200%_100%]" />
                  <span className="relative">Get my quote</span>
                  <span className="relative text-lg">→</span>
                </Link>
                <Link href="/track" className="rounded-[13px] border border-line bg-white px-6 py-4 text-base font-semibold text-ink-900 transition hover:border-brand-600">
                  Track a trade-in
                </Link>
              </div>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-11 flex gap-6 sm:gap-10">
                <Stat label="Paid out"><CountUp value={2.4} decimals={1} prefix="$" suffix="M+" /></Stat>
                <Divider />
                <Stat label="Devices bought"><CountUp value={38902} /></Stat>
                <Divider />
                <Stat label="Rating">
                  <span className="flex items-center gap-1.5">
                    <CountUp value={4.8} decimals={1} />
                    <span className="text-[22px] text-brand-600">★</span>
                  </span>
                </Stat>
              </div>
            </Reveal>
          </div>

          {/* Phone mockup */}
          <Reveal variant="blur" className="relative flex min-h-[560px] items-center justify-center">
            <div className="relative flex justify-center">
              <div className="absolute inset-[-26px] bg-[radial-gradient(circle_at_50%_42%,rgba(28,160,221,.4),transparent_70%)] blur-[22px]" />
              <div className="relative h-[580px] w-[286px] animate-floaty rounded-[46px] bg-[linear-gradient(160deg,#12241B,#0B1410)] p-[11px] shadow-[0_44px_90px_-34px_rgba(11,20,16,.65),inset_0_0_0_1px_rgba(255,255,255,.05)]">
                <div className="relative h-full overflow-hidden rounded-[36px] bg-[linear-gradient(180deg,#F8FBF9,#E9F2EB)]">
                  <div className="absolute left-1/2 top-[13px] z-[3] h-[25px] w-[92px] -translate-x-1/2 rounded-[14px] bg-ink-900" />
                  <div className="pointer-events-none absolute inset-0 z-[2] animate-screenShine bg-[linear-gradient(115deg,transparent_42%,rgba(255,255,255,.7)_50%,transparent_58%)] bg-[length:250%_100%]" />
                  <div className="relative z-[1] px-[22px] pb-[22px] pt-[52px]">
                    <div className="flex items-center justify-between text-xs font-semibold text-ink-400">
                      <span>9:41</span>
                      <span className="font-display font-extrabold text-ink-900">JustMac</span>
                    </div>
                    <div className="mt-[30px] text-[13px] font-semibold text-ink-400">Your instant offer</div>
                    <div className="mt-[5px] flex items-baseline gap-[3px]">
                      <span className="font-display text-[30px] font-extrabold text-brand-600">$</span>
                      <span className="font-display text-[56px] font-extrabold leading-none tracking-[-0.03em] text-ink-900">573</span>
                    </div>
                    <div className="mt-[2px] text-[12.5px] text-ink-500">iPhone 15 Pro · Good condition</div>
                    <div className="mt-[22px] flex flex-col gap-2.5">
                      {["Screen · Flawless", "Battery · 96%", "Unlocked"].map((t) => (
                        <div key={t} className="flex items-center justify-between rounded-[12px] border border-[#E7EFE9] bg-white px-3.5 py-[11px] text-[13px] font-semibold text-ink-700">
                          {t} <span className="text-brand-600">✓</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 animate-btnPulse rounded-[14px] bg-brand-600 py-3.5 text-center text-[15px] font-bold text-white">
                      Accept offer →
                    </div>
                  </div>
                </div>
              </div>
              <Coin className="left-[-6%] top-[40px] h-14 w-14 animate-coinA text-[23px]" />
              <Coin className="right-[-6%] top-[150px] h-[46px] w-[46px] animate-coinB text-[19px]" />
              <Coin className="bottom-[120px] left-[-8%] h-10 w-10 animate-coinC text-base" />
              <div className="absolute bottom-[78px] right-[-4px] flex animate-floaty items-center gap-2.5 rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-[0_22px_50px_-22px_rgba(11,20,16,.4)] backdrop-blur">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-[15px] text-brand-600">✓</div>
                <div>
                  <div className="text-[13.5px] font-bold">Paid in 2 days</div>
                  <div className="text-[11.5px] text-ink-400">ACH · PayPal · Zelle</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </header>

      {/* ---------- Press marquee ---------- */}
      <section className="overflow-hidden border-y border-line bg-white py-6">
        <div className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">As featured on</div>
        <div className="relative [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="flex w-max animate-marquee gap-[60px]">
            {[...PRESS, ...PRESS].map((p, i) => (
              <span key={i} className="whitespace-nowrap font-display text-[22px] font-bold text-ink-300">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Popular devices ---------- */}
      <section className="px-5 pb-10 pt-16 sm:px-8 sm:pt-24">
        <div className="mx-auto max-w-page">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <Reveal variant="left">
              <div className="eyebrow">Top payouts this week</div>
              <h2 className="mt-2.5 font-display text-[clamp(30px,4vw,46px)] font-extrabold tracking-[-0.03em]">Popular devices</h2>
            </Reveal>
            <Reveal variant="right">
              <Link href="/sell" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-600">See all →</Link>
            </Reveal>
          </div>

          {models.length === 0 ? (
            <p className="card p-6 text-ink-500">No devices yet — is the API running and seeded?</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {models.map((m, i) => (
                <Reveal key={m.id} delay={i * 80}>
                  <Link href={`/sell/${m.slug}`}>
                    <Tilt className="rounded-[20px] border border-line bg-white p-[18px]">
                      <div className="relative flex h-[170px] items-center justify-center overflow-hidden rounded-[14px] bg-[linear-gradient(155deg,#ECEFF8,#F6F7FC)]">
                        <div className="relative z-[1] flex h-full w-full items-center justify-center p-3">
                          <DeviceVisual imageUrl={m.imageUrl} kind={deviceKind(m.category)} tint={TINTS[i % TINTS.length]} />
                        </div>
                        <div className="absolute bottom-0 left-0 top-0 z-[2] w-[42%] animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)]" />
                      </div>
                      <div className="mt-[18px] text-xs font-semibold uppercase tracking-[0.1em] text-ink-300">{m.brand}</div>
                      <div className="mt-1.5 font-display text-[18px] font-bold tracking-[-0.01em]">{m.name}</div>
                      <div className="mt-3.5 text-[13px] text-ink-400">Cash up to</div>
                      <div className="mt-0.5 font-display text-[34px] font-extrabold tracking-[-0.02em] text-brand-600">
                        <CountUp value={m.cashUpTo} prefix="$" />
                      </div>
                      <div className="mt-3.5 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-ink-900">Get my quote <span>→</span></div>
                    </Tilt>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Device pill marquee ---------- */}
      <section className="overflow-hidden pb-12 pt-1.5">
        <div className="relative [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="flex w-max animate-marqueeRev gap-3.5">
            {[...DEVICE_MQ, ...DEVICE_MQ].map((m, i) => (
              <span key={i} className="whitespace-nowrap rounded-full border border-line bg-white px-[17px] py-2.5 text-sm font-semibold text-ink-500">{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works (dark) ---------- */}
      <section className="relative overflow-hidden bg-brand-900 px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="pointer-events-none absolute left-[10%] top-[-80px] h-[400px] w-[400px] animate-glowmove rounded-full bg-[radial-gradient(circle,rgba(91,194,239,.18),transparent_65%)]" />
        <div className="relative mx-auto max-w-[1120px]">
          <Reveal className="mb-14 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">How it works</div>
            <h2 className="mt-3 font-display text-[clamp(30px,4.2vw,52px)] font-extrabold tracking-[-0.03em]">From drawer to dollars in three steps</h2>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="rounded-[22px] border border-white/10 bg-white/[.04] p-7 backdrop-blur">
                  <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[18px] bg-[linear-gradient(150deg,#29A9E0,#15498F)] font-display text-[28px] font-extrabold shadow-[0_16px_34px_-14px_rgba(28,160,221,.7)]">{s.n}</div>
                  <h3 className="mt-5 font-display text-[22px] font-bold tracking-[-0.02em]">{s.title}</h3>
                  <p className="mt-3 text-[15.5px] leading-relaxed text-white/[.66]">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Why us ---------- */}
      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <Reveal className="mb-14 text-center">
            <div className="eyebrow">Why people choose us</div>
            <h2 className="mx-auto mt-3 max-w-[680px] font-display text-[clamp(30px,4.2vw,52px)] font-extrabold tracking-[-0.03em]">Trusted by sellers, loved for the payout</h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHYUS.map((w, i) => (
              <Reveal key={w.label} variant="zoom" delay={i * 70}>
                <div className="group h-full rounded-[20px] border border-line bg-white p-[30px] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_56px_-30px_rgba(11,20,16,.35)]">
                  <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-brand-50 text-brand-600">
                    <WhyIcon name={w.icon} />
                  </div>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-[38px] font-extrabold tracking-[-0.02em] text-ink-900">
                      {w.static ? w.static : <CountUp value={w.value ?? 0} decimals={w.decimals ?? 0} prefix={w.prefix ?? ""} suffix={w.suffix ?? ""} />}
                    </span>
                    {w.unit && <span className="text-[18px] font-bold text-brand-600">{w.unit}</span>}
                  </div>
                  <div className="mt-1.5 font-display text-[18px] font-bold">{w.label}</div>
                  <p className="mt-2 text-[14.5px] leading-snug text-ink-400">{w.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Testimonials ---------- */}
      <section className="border-t border-line bg-white px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <Reveal variant="left" className="mb-12">
            <div className="eyebrow">Testimonials</div>
            <h2 className="mt-3 max-w-[560px] font-display text-[clamp(30px,4.2vw,50px)] font-extrabold tracking-[-0.03em]">What winning trust sounds like</h2>
          </Reveal>
          <div className="grid gap-5 lg:grid-cols-3">
            {REVIEWS.map((r, i) => (
              <Reveal key={r.name} delay={i * 80}>
                <div className="flex h-full flex-col rounded-[20px] border border-line bg-canvas p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_56px_-30px_rgba(11,20,16,.3)]">
                  <div className="tracking-[2px] text-brand-600">★★★★★</div>
                  <p className="my-4 flex-1 text-[15.5px] leading-relaxed text-ink-700">{r.quote}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full font-display text-base font-bold text-white" style={{ background: r.av }}>{r.initial}</div>
                    <div>
                      <div className="text-[15px] font-bold">{r.name}</div>
                      <div className="text-[13px] text-ink-400">{r.place}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[820px]">
          <Reveal className="mb-11 text-center">
            <div className="eyebrow">FAQ</div>
            <h2 className="mt-3 font-display text-[clamp(30px,4.2vw,50px)] font-extrabold tracking-[-0.03em]">Questions, answered</h2>
          </Reveal>
          <Faq />
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="px-5 pb-24 sm:px-8">
        <Reveal variant="zoom" className="relative mx-auto max-w-page overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0E2F52,#07223D)] p-10 sm:p-16">
          <div className="pointer-events-none absolute right-[-40px] top-[-60px] h-[380px] w-[380px] animate-glowmove rounded-full bg-[radial-gradient(circle,rgba(91,194,239,.3),transparent_65%)]" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.1fr_.9fr] md:gap-14">
            <div>
              <h2 className="font-display text-[clamp(32px,4.4vw,56px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-white">Still sitting on that old tech? Do something smart about it.</h2>
              <p className="mt-5 max-w-[440px] text-[17px] leading-relaxed text-white/70">Get a free quote in under a minute. No listings, no haggling, no waiting on strangers.</p>
              <div className="mt-8 flex flex-wrap gap-3.5">
                <Link href="/sell" className="inline-flex items-center gap-2 rounded-[13px] bg-brand-600 px-7 py-4 text-base font-bold text-white shadow-[0_18px_40px_-16px_rgba(28,160,221,.7)]">Sell your device now →</Link>
                <Link href="/sell" className="inline-flex items-center rounded-[13px] border border-white/[.18] bg-white/[.08] px-6 py-4 text-base font-semibold text-white transition hover:bg-white/[.16]">Get a free quote</Link>
              </div>
              <div className="mt-7 flex items-center gap-2.5">
                <span className="tracking-[2px] text-brand-400">★★★★★</span>
                <span className="text-sm text-white/[.78]"><span className="font-bold text-white"><CountUp value={500000} suffix="+" /></span> satisfied sellers</span>
              </div>
            </div>
            <div className="relative hidden h-[280px] items-center justify-center md:flex">
              <div className="absolute h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(91,194,239,.45),transparent_68%)] blur-md" />
              <div className="absolute h-[116px] w-[200px] animate-noteFloat rounded-2xl bg-[linear-gradient(150deg,#29A9E0,#15498F)] shadow-[0_24px_50px_-18px_rgba(0,0,0,.5)]" style={{ "--rot": "-9deg", transform: "rotate(-9deg) translateY(14px)" } as React.CSSProperties}>
                <div className="absolute inset-3 flex items-center justify-center rounded-[10px] border-[1.5px] border-white/40 font-display text-[34px] font-extrabold text-white/90">$</div>
              </div>
              <div className="absolute h-[116px] w-[200px] animate-noteFloat rounded-2xl bg-[linear-gradient(150deg,#5BC2EF,#1C5FB6)] shadow-[0_24px_50px_-18px_rgba(0,0,0,.5)]" style={{ "--rot": "7deg", transform: "rotate(7deg) translateY(-16px)", animationDelay: ".4s" } as React.CSSProperties}>
                <div className="absolute inset-3 flex items-center justify-center rounded-[10px] border-[1.5px] border-white/45 font-display text-[34px] font-extrabold text-white">$</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </SiteChrome>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-medium text-ink-400">{label}</div>
      <div className="mt-1 font-display text-[clamp(26px,3vw,34px)] font-extrabold tracking-[-0.02em]">{children}</div>
    </div>
  );
}
function Divider() {
  return <div className="w-px bg-[linear-gradient(#E2E8E5,transparent)]" />;
}
function Coin({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute flex items-center justify-center rounded-full border border-white/30 bg-[radial-gradient(circle_at_34%_30%,#5BC2EF,#15498F)] font-display font-extrabold text-white shadow-[0_16px_28px_-10px_rgba(28,95,182,.6),inset_0_2px_3px_rgba(255,255,255,.45)] ${className}`}
    >
      $
    </div>
  );
}

function WhyIcon({ name }: { name: string }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "star": return <svg {...common}><path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>;
    case "shield": return <svg {...common}><path d="M12 3l7 3v5.5c0 4.3-3 7-7 8.5-4-1.5-7-4.2-7-8.5V6z" /><path d="M9 12l2 2 4-4" /></svg>;
    case "bolt": return <svg {...common}><path d="M13 2L5 13h5l-1 9 9-12h-6z" /></svg>;
    case "trend": return <svg {...common}><polyline points="3 16 9 10 13 14 21 6" /><polyline points="15 6 21 6 21 12" /></svg>;
    case "award": return <svg {...common}><circle cx="12" cy="9" r="5" /><path d="M8.5 13.3L7 22l5-3 5 3-1.5-8.7" /></svg>;
    case "cast": return <svg {...common}><circle cx="12" cy="13" r="2" /><path d="M8.3 9.3a5 5 0 000 7.4M15.7 16.7a5 5 0 000-7.4M5.6 6.6a9 9 0 000 13M18.4 19.6a9 9 0 000-13" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

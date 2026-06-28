"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ModelDetailDto, QuoteResponse } from "@sellme/shared";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import Link from "next/link";
import { PriceBreakdown } from "@/components/PriceBreakdown";
import { PhotoCapture } from "@/components/PhotoCapture";
import { PriceWatchForm } from "@/components/PriceWatchForm";
import { DeviceVisual, deviceKind } from "@/components/DeviceArt";

type Selections = Record<string, string>; // attributeKey -> optionKey

export function QuoteWizard({ model }: { model: ModelDetailDto }) {
  const router = useRouter();
  const add = useCart((s) => s.add);

  // Steps: 0 = variant, 1..N = condition attributes, N+1 = photos, N+2 = offer
  const condCount = model.conditionAttributes.length;
  const photoStep = condCount + 1;
  const offerStep = condCount + 2;
  const totalSteps = offerStep + 1;

  const [step, setStep] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(model.variants[0]?.id ?? null);
  const [selections, setSelections] = useState<Selections>({});
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const conditionsPayload = useMemo(
    () =>
      Object.entries(selections).map(([attributeKey, optionKey]) => ({ attributeKey, optionKey })),
    [selections],
  );

  async function fetchQuote() {
    if (!variantId) return;
    setLoading(true);
    setError(null);
    try {
      const q = await api.createQuote({ variantId, conditions: conditionsPayload });
      setQuote(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not price this device.");
    } finally {
      setLoading(false);
    }
  }

  function goTo(next: number) {
    setAdded(false);
    if (next === offerStep) void fetchQuote();
    setStep(next);
  }

  const canAdvance =
    step === 0 ? !!variantId : step <= condCount ? !!selections[model.conditionAttributes[step - 1]?.key] : true;

  function addToBox() {
    if (!quote) return;
    const variant = model.variants.find((v) => v.id === quote.variantId);
    add({
      quoteId: quote.quoteId,
      modelName: model.name,
      variantLabel: variant?.label ?? "",
      offer: quote.offer,
      currency: quote.currency,
      lockExpiresAt: quote.lockExpiresAt,
      category: model.category.toLowerCase(),
    });
    setAdded(true);
  }

  const stepLabels = [
    "Configuration",
    ...model.conditionAttributes.map((a) => a.label),
    "Photos",
    "Your offer",
  ];
  const kind = deviceKind(model.category);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-ink-400">
        <Link href="/sell" className="hover:text-brand-700">Sell</Link>
        <span>/</span>
        <span className="text-ink-600">{model.brand}</span>
        <span>/</span>
        <span className="font-medium text-ink-900">{model.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden p-6">
            <div className="flex h-40 items-center justify-center rounded-2xl bg-[linear-gradient(155deg,#ECEFF8,#F6F7FC)] p-3">
              <DeviceVisual imageUrl={model.imageUrl} kind={kind} tint="#9FB3D8" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-300">{model.brand}</p>
            <p className="font-display text-xl font-bold tracking-[-0.01em]">{model.name}</p>

            <ol className="mt-5 space-y-2.5">
              {stepLabels.map((label, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <li key={label} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                        done
                          ? "bg-brand-600 text-white"
                          : active
                            ? "bg-brand-50 text-brand-700 ring-2 ring-brand-600"
                            : "bg-canvas text-ink-300"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={active ? "font-semibold text-ink-900" : done ? "text-ink-600" : "text-ink-300"}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <span className="mt-0.5 text-brand-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5.5c0 4.3-3 7-7 8.5-4-1.5-7-4.2-7-8.5V6z" /><path d="M9 12l2 2 4-4" /></svg>
            </span>
            <div>
              <p className="text-sm font-bold text-brand-900">Fair-Evaluation Promise</p>
              <p className="mt-0.5 text-[13px] leading-snug text-brand-700">
                Describe it accurately and we honor the quote. Reject an adjusted offer and we ship it back free.
              </p>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div>
          {/* Progress */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs font-medium text-ink-400">
              <span>Step {step + 1} of {totalSteps}</span>
              <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-500"
                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <div className="card p-6 sm:p-7">
        {/* Step 0: variant */}
        {step === 0 && (
          <Step title="Choose your configuration" helper="Pick the storage/model that matches your device.">
            <div className="grid gap-3">
              {model.variants.map((v) => (
                <OptionRow
                  key={v.id}
                  selected={variantId === v.id}
                  onSelect={() => setVariantId(v.id)}
                  label={v.label}
                  helper={Object.values(v.attributes).join(" · ")}
                />
              ))}
            </div>
          </Step>
        )}

        {/* Steps 1..N: conditions */}
        {step >= 1 && step <= condCount && (() => {
          const attr = model.conditionAttributes[step - 1];
          return (
            <Step title={attr.label} helper={attr.helper ?? undefined}>
              <div className="grid gap-3">
                {attr.options.map((o) => (
                  <OptionRow
                    key={o.key}
                    selected={selections[attr.key] === o.key}
                    onSelect={() => setSelections((s) => ({ ...s, [attr.key]: o.key }))}
                    label={o.label}
                    helper={o.helper ?? undefined}
                  />
                ))}
              </div>
            </Step>
          );
        })()}

        {/* Photo step */}
        {step === photoStep && (
          <Step
            title="Add photos of your device"
            helper="Optional, but photos tighten your quote and speed up inspection."
          >
            <PhotoCapture />
          </Step>
        )}

        {/* Offer step */}
        {step === offerStep && (
          <div>
            <h2 className="font-display text-2xl font-bold tracking-[-0.01em]">Your instant offer</h2>
            {loading && <p className="mt-4 text-ink-500">Calculating…</p>}
            {error && <p className="mt-4 text-red-600">{error}</p>}
            {quote && !loading && (
              <div className="mt-5">
                <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#E3F2FB,#EDF4FC)] p-7 text-center">
                  <div className="pointer-events-none absolute right-[-30px] top-[-30px] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(91,194,239,.35),transparent_70%)]" />
                  <p className="relative text-sm font-medium text-ink-500">We'll pay you up to</p>
                  <p className="relative mt-1 font-display text-[56px] font-extrabold leading-none tracking-[-0.03em] text-brand-700">
                    {money(quote.offer, quote.currency)}
                  </p>
                  <p className="relative mt-2 text-sm text-ink-500">
                    Most units in this condition pay{" "}
                    <span className="font-semibold text-ink-700">
                      {money(quote.confidenceLow)}–{money(quote.confidenceHigh)}
                    </span>
                  </p>
                </div>

                <PriceBreakdown breakdown={quote.breakdown} currency={quote.currency} lockExpiresAt={quote.lockExpiresAt} />

                <PriceWatchForm variantId={quote.variantId} currentOffer={quote.offer} />

                {/* Editable summary */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-ink-700">Your answers</h3>
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                    {model.conditionAttributes.map((attr, i) => {
                      const opt = attr.options.find((o) => o.key === selections[attr.key]);
                      return (
                        <li key={attr.key} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-ink-500">{attr.label}</span>
                          <span className="flex items-center gap-3">
                            <span className="font-medium">{opt?.label ?? "—"}</span>
                            <button
                              onClick={() => goTo(i + 1)}
                              className="text-xs font-semibold text-brand-700 hover:underline"
                            >
                              ✎ edit
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-6 flex gap-3">
                  {added ? (
                    <>
                      <button className="btn-primary flex-1" onClick={() => router.push("/cart")}>
                        Go to Your Box →
                      </button>
                      <button className="btn-ghost" onClick={() => router.push("/sell")}>
                        Add another
                      </button>
                    </>
                  ) : (
                    <button className="btn-primary w-full" onClick={addToBox}>
                      Add to Your Box
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        {step !== offerStep && (
          <div className="mt-6 flex items-center justify-between">
            <button
              className="btn-ghost"
              onClick={() => goTo(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              Back
            </button>
            <button className="btn-primary" onClick={() => goTo(step + 1)} disabled={!canAdvance}>
              {step === photoStep ? "See my offer" : "Continue"}
            </button>
          </div>
        )}
        {step === offerStep && (
          <div className="mt-4">
            <button className="btn-ghost" onClick={() => goTo(photoStep)}>
              Back
            </button>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold tracking-[-0.01em]">{title}</h2>
      {helper && <p className="mt-1.5 text-sm text-ink-500">{helper}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function OptionRow({
  selected,
  onSelect,
  label,
  helper,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  helper?: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
        selected
          ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
          : "border-line hover:border-brand-300 hover:bg-canvas"
      }`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[11px] transition ${
          selected ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300"
        }`}
      >
        {selected && "✓"}
      </span>
      <span>
        <span className="block font-semibold">{label}</span>
        {helper && <span className="block text-sm text-ink-500">{helper}</span>}
      </span>
    </button>
  );
}

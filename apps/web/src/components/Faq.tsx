"use client";

import { useState } from "react";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I get a quote?",
    a: "Pick your device, tell us the model and condition, and you get an instant cash quote with a full price breakdown — no account or commitment required.",
  },
  {
    q: "Is shipping really free?",
    a: "Yes. Every accepted quote comes with a prepaid, trackable shipping label (or a free shipping kit on request). You never pay to send your device in.",
  },
  {
    q: "How long is my quote valid?",
    a: "Quotes are locked for 30 days. Ship within that window and the price you were quoted is the price we honor after inspection.",
  },
  {
    q: "How and when do I get paid?",
    a: "Once we receive and inspect your device — usually within a day or two — we pay via ACH, PayPal, check, or Zelle, whichever you prefer.",
  },
  {
    q: "What if I don't agree with the final offer?",
    a: "Our Fair-Evaluation Promise means if our inspection changes the offer and you reject it, we ship your device back to you free of charge.",
  },
];

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <div className="flex flex-col gap-3.5">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="overflow-hidden rounded-2xl border border-line bg-white">
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full select-none items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-display text-[17px] font-semibold tracking-[-0.01em]">{f.q}</span>
              <span
                className="shrink-0 text-2xl font-light leading-none transition-transform duration-300"
                style={{
                  transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                  color: isOpen ? "#1C5FB6" : "#0B1410",
                }}
              >
                +
              </span>
            </button>
            <div
              className="grid transition-all duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)]"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", opacity: isOpen ? 1 : 0 }}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-[15.5px] leading-relaxed text-ink-500">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

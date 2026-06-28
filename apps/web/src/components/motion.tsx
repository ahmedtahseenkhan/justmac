"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Variant = "up" | "left" | "right" | "blur" | "zoom";
const VARIANT_CLASS: Record<Variant, string> = {
  up: "",
  left: "from-left",
  right: "from-right",
  blur: "blur",
  zoom: "zoom",
};

function useInView<T extends HTMLElement>(once = true) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return { ref, inView };
}

/** Scroll-reveal wrapper. Add `delay` (ms) to stagger siblings. */
export function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${VARIANT_CLASS[variant]} ${inView ? "in" : ""} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Renders the final value by default (so SSR / no-JS / reduced-motion show the real
 * number), and counts up from 0 as a progressive enhancement when scrolled into view.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const fmt = (v: number) => (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US"));
  // null = show the final value; a number = mid-animation.
  const [partial, setPartial] = useState<number | null>(null);

  useEffect(() => {
    if (!inView) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const dur = 1500;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        setPartial(value * eased);
        raf = requestAnimationFrame(tick);
      } else {
        setPartial(null); // settle on the exact final value
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {fmt(partial ?? value)}
      {suffix}
    </span>
  );
}

/** Subtle pointer-driven 3D tilt for cards. */
export function Tilt({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(720px) rotateX(${-py * 7}deg) rotateY(${px * 9}deg) translateY(-6px)`;
    el.style.boxShadow = "0 32px 64px -30px rgba(11,20,16,.45)";
    el.style.borderColor = "#BBDDF3";
  }
  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(720px) rotateX(0deg) rotateY(0deg)";
    el.style.boxShadow = "";
    el.style.borderColor = "";
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={className}
      style={{ transition: "transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease", willChange: "transform" }}
    >
      {children}
    </div>
  );
}

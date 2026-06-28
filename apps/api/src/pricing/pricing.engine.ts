import type { BreakdownLine } from "@sellme/shared";

/**
 * Pure pricing engine. No I/O — takes resolved inputs and returns the offer plus a
 * transparent, line-by-line breakdown. Kept side-effect free so it is trivially
 * testable and so it can be lifted into a standalone pricing microservice later.
 *
 *   fair = base * market * depreciation
 *   fair *= Π condition multipliers
 *   offer = clamp( fair * (1 - margin), floor, ceiling )
 */

export interface ConditionFactor {
  /** Human label, e.g. "Cosmetic: Good — light wear". */
  label: string;
  multiplier: number;
}

export interface PricingInputs {
  baseValue: number;
  floor: number;
  ceiling: number;
  /** Per-category target margin, e.g. 0.28. */
  targetMargin: number;
  /** Live demand/supply signal (1.0 = neutral). */
  marketFactor: number;
  /** Time-decay factor (<= 1.0). */
  depreciationFactor: number;
  conditions: ConditionFactor[];
}

export interface PricingResult {
  offer: number;
  confidenceLow: number;
  confidenceHigh: number;
  breakdown: BreakdownLine[];
}

const round = (n: number) => Math.round(n);

export function computeQuote(input: PricingInputs): PricingResult {
  const breakdown: BreakdownLine[] = [];
  let running = input.baseValue;

  breakdown.push({
    label: "Base value",
    kind: "base",
    factor: null,
    amount: round(input.baseValue),
    runningTotal: round(running),
  });

  const applyFactor = (
    label: string,
    kind: BreakdownLine["kind"],
    factor: number,
  ) => {
    const before = running;
    running = running * factor;
    breakdown.push({
      label,
      kind,
      factor,
      amount: round(running - before),
      runningTotal: round(running),
    });
  };

  applyFactor(
    `Market demand (${input.marketFactor >= 1 ? "+" : ""}${Math.round((input.marketFactor - 1) * 100)}%)`,
    "market",
    input.marketFactor,
  );
  applyFactor(
    `Age depreciation (${Math.round((input.depreciationFactor - 1) * 100)}%)`,
    "depreciation",
    input.depreciationFactor,
  );

  for (const c of input.conditions) {
    applyFactor(c.label, "condition", c.multiplier);
  }

  // Margin: the spread the business keeps between buyback and resale.
  const fairValue = running;
  applyFactor(`Service margin (−${Math.round(input.targetMargin * 100)}%)`, "margin", 1 - input.targetMargin);

  // Guardrails — never quote below floor or above ceiling (or above fair value).
  let offer = running;
  const ceiling = Math.min(input.ceiling, fairValue);
  if (offer > ceiling) {
    const before = offer;
    offer = ceiling;
    breakdown.push({
      label: "Ceiling cap",
      kind: "guardrail",
      factor: null,
      amount: round(offer - before),
      runningTotal: round(offer),
    });
  }
  if (offer < input.floor) {
    const before = offer;
    offer = input.floor;
    breakdown.push({
      label: "Floor guarantee",
      kind: "guardrail",
      factor: null,
      amount: round(offer - before),
      runningTotal: round(offer),
    });
  }

  offer = round(offer);

  // Confidence band: pre-inspection expectation range (±7%, clamped to guardrails).
  const confidenceLow = Math.max(input.floor, round(offer * 0.93));
  const confidenceHigh = Math.min(input.ceiling, round(offer * 1.05));

  return { offer, confidenceLow, confidenceHigh, breakdown };
}

/**
 * Deterministic stand-ins for the live market + depreciation layers.
 * Replace with real feeds (MarketFeed / DepreciationModel) in Phase 3 — the engine
 * signature does not change, only where these two numbers come from.
 */
export function marketFactorFor(variantId: string): number {
  // Stable pseudo-signal in [0.95, 1.06] derived from the id so quotes feel "live"
  // but stay reproducible within a process. Real impl pulls from MarketFeed.
  let h = 0;
  for (const ch of variantId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const swing = (h % 1100) / 10000; // 0 .. 0.11
  return Number((0.95 + swing).toFixed(4));
}

export function depreciationFactorFor(modelCreatedAt: Date, now: Date): number {
  // ~1.5% value decay per month since the model was catalogued, floored at 0.6.
  const months = Math.max(0, (now.getTime() - modelCreatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30));
  return Number(Math.max(0.6, 1 - months * 0.015).toFixed(4));
}

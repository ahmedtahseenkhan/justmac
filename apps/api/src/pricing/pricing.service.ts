import { Injectable, NotFoundException } from "@nestjs/common";
import type { ConditionSelection } from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import {
  computeQuote,
  depreciationFactorFor,
  marketFactorFor,
  type ConditionFactor,
  type PricingResult,
} from "./pricing.engine";

const QUOTE_TTL_SECONDS = 60; // short TTL keeps quotes feeling "live" while caching hot configs

export interface PricedQuote extends PricingResult {
  variantId: string;
  currency: string;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private cacheKey(variantId: string, conditions: ConditionSelection[]): string {
    const sig = conditions
      .map((c) => `${c.attributeKey}:${c.optionKey}`)
      .sort()
      .join("|");
    return `quote:${variantId}:${sig}`;
  }

  async price(
    variantId: string,
    conditions: ConditionSelection[],
    opts: { fresh?: boolean } = {},
  ): Promise<PricedQuote> {
    const key = this.cacheKey(variantId, conditions);
    if (!opts.fresh) {
      const cached = await this.cache.get(key);
      if (cached) return JSON.parse(cached) as PricedQuote;
    }

    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
      include: {
        model: { include: { category: true, conditionAttributes: { include: { options: true } } } },
        priceBases: { where: { expiresAt: null }, orderBy: { effectiveAt: "desc" }, take: 1 },
      },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);
    const base = variant.priceBases[0];
    if (!base) throw new NotFoundException(`No active base price for variant ${variantId}`);

    // Live demand signal: editable MarketFeed row, falling back to the deterministic stub.
    const feed = await this.prisma.marketFeed.findUnique({ where: { modelId: variant.modelId } });
    const marketFactor = feed?.factor ?? marketFactorFor(variantId);

    // Resolve each submitted condition selection to its multiplier + label.
    const factors: ConditionFactor[] = [];
    for (const sel of conditions) {
      const attr = variant.model.conditionAttributes.find((a) => a.key === sel.attributeKey);
      const opt = attr?.options.find((o) => o.key === sel.optionKey);
      if (attr && opt) {
        factors.push({ label: `${attr.label}: ${opt.label}`, multiplier: opt.multiplier });
      }
    }

    const result = computeQuote({
      baseValue: base.baseValue,
      floor: base.floor,
      ceiling: base.ceiling,
      targetMargin: variant.model.category.targetMargin,
      marketFactor,
      depreciationFactor: depreciationFactorFor(variant.model.createdAt, new Date()),
      conditions: factors,
    });

    const priced: PricedQuote = { ...result, variantId, currency: "USD" };
    await this.cache.set(key, JSON.stringify(priced), QUOTE_TTL_SECONDS);
    return priced;
  }

  /** Highest realistic offer for a model — powers the "Cash up to $X" teaser. */
  async cashUpTo(modelId: string): Promise<number> {
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
      include: {
        category: true,
        variants: { include: { priceBases: { where: { expiresAt: null }, orderBy: { effectiveAt: "desc" }, take: 1 } } },
      },
    });
    if (!model) return 0;
    const feed = await this.prisma.marketFeed.findUnique({ where: { modelId } });
    let best = 0;
    for (const v of model.variants) {
      const base = v.priceBases[0];
      if (!base) continue;
      // Best case: flawless everything (no condition penalty), real market + margin applied.
      const r = computeQuote({
        baseValue: base.baseValue,
        floor: base.floor,
        ceiling: base.ceiling,
        targetMargin: model.category.targetMargin,
        marketFactor: feed?.factor ?? marketFactorFor(v.id),
        depreciationFactor: depreciationFactorFor(model.createdAt, new Date()),
        conditions: [],
      });
      best = Math.max(best, r.offer);
    }
    return best;
  }
}

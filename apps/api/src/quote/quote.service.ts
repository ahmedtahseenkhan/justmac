import { Injectable } from "@nestjs/common";
import type { QuoteRequest, QuoteResponse } from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";

const LOCK_DAYS = 30;

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /** Price a config and persist an immutable, 30-day-locked quote snapshot. */
  async createQuote(req: QuoteRequest): Promise<QuoteResponse> {
    const priced = await this.pricing.price(req.variantId, req.conditions);
    const lockExpiresAt = new Date(Date.now() + LOCK_DAYS * 24 * 60 * 60 * 1000);

    const quote = await this.prisma.quote.create({
      data: {
        variantId: req.variantId,
        conditions: req.conditions,
        breakdown: priced.breakdown,
        offer: priced.offer,
        currency: priced.currency,
        confidenceLow: priced.confidenceLow,
        confidenceHigh: priced.confidenceHigh,
        lockExpiresAt,
      },
    });

    return {
      quoteId: quote.id,
      variantId: req.variantId,
      offer: priced.offer,
      currency: priced.currency,
      confidenceLow: priced.confidenceLow,
      confidenceHigh: priced.confidenceHigh,
      breakdown: priced.breakdown,
      lockExpiresAt: lockExpiresAt.toISOString(),
      conditions: req.conditions,
    };
  }
}

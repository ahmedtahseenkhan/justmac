import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreatePriceWatchRequest,
  PriceWatchDto,
  PriceWatchRunResult,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";

@Injectable()
export class PriceWatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /** "Notify me if my device's quote rises above $X." Tracks the variant's best offer. */
  async create(req: CreatePriceWatchRequest): Promise<PriceWatchDto> {
    const variant = await this.prisma.variant.findUnique({
      where: { id: req.variantId },
      include: { model: true },
    });
    if (!variant) throw new NotFoundException("Variant not found");

    const priced = await this.pricing.price(req.variantId, []); // best-case (no condition penalty)
    const watch = await this.prisma.priceWatch.create({
      data: {
        email: req.email,
        variantId: req.variantId,
        modelName: variant.model.name,
        variantLabel: variant.label,
        threshold: req.threshold,
        lastOffer: priced.offer,
      },
    });
    return toDto(watch);
  }

  async list(email?: string): Promise<PriceWatchDto[]> {
    const watches = await this.prisma.priceWatch.findMany({
      where: email ? { email } : {},
      orderBy: { createdAt: "desc" },
    });
    return watches.map(toDto);
  }

  /**
   * Re-price every active watch and fire an alert for any whose current best offer has
   * reached its threshold. Stands in for a scheduled checker job.
   */
  async runChecks(): Promise<PriceWatchRunResult> {
    const active = await this.prisma.priceWatch.findMany({ where: { active: true } });
    const triggered: PriceWatchDto[] = [];

    for (const w of active) {
      const priced = await this.pricing.price(w.variantId, [], { fresh: true });
      const crossed = priced.offer >= w.threshold;
      const updated = await this.prisma.priceWatch.update({
        where: { id: w.id },
        data: {
          lastOffer: priced.offer,
          ...(crossed ? { triggeredAt: new Date(), active: false } : {}),
        },
      });
      if (crossed) {
        // Real impl emails the watcher; here we log via the notifications service.
        // (PriceWatch isn't tied to an Order, so we just record the trigger.)
        triggered.push(toDto(updated));
      }
    }
    return { checked: active.length, triggered };
  }
}

function toDto(w: any): PriceWatchDto {
  return {
    id: w.id,
    email: w.email,
    modelName: w.modelName,
    variantLabel: w.variantLabel,
    threshold: w.threshold,
    lastOffer: w.lastOffer,
    active: w.active,
    triggeredAt: w.triggeredAt ? w.triggeredAt.toISOString() : null,
    createdAt: w.createdAt.toISOString(),
  };
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminCategoryDto,
  AdminModelDto,
  BulkPriceRequest,
  BulkPriceResult,
  ConditionSelection,
  SimulateResponse,
  UpdateVariantPriceRequest,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async categories(): Promise<AdminCategoryDto[]> {
    const cats = await this.prisma.category.findMany({
      include: { _count: { select: { models: true } } },
      orderBy: { name: "asc" },
    });
    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      targetMargin: c.targetMargin,
      modelCount: c._count.models,
    }));
  }

  async models(categorySlug?: string): Promise<AdminModelDto[]> {
    const models = await this.prisma.model.findMany({
      where: categorySlug ? { category: { slug: categorySlug } } : {},
      include: {
        brand: true,
        category: true,
        variants: {
          include: { priceBases: { where: { expiresAt: null }, orderBy: { effectiveAt: "desc" }, take: 1 } },
        },
      },
      orderBy: { name: "asc" },
    });

    // Market feeds, fetched in one pass.
    const feeds = await this.prisma.marketFeed.findMany({
      where: { modelId: { in: models.map((m) => m.id) } },
    });
    const feedByModel = new Map(feeds.map((f) => [f.modelId, f]));

    return models.map((m) => {
      const feed = feedByModel.get(m.id);
      return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        brand: m.brand.name,
        categorySlug: m.category.slug,
        categoryName: m.category.name,
        targetMargin: m.category.targetMargin,
        marketFactor: feed?.factor ?? 1.0,
        feedUpdatedAt: feed?.updatedAt.toISOString() ?? null,
        variants: m.variants.map((v) => {
          const base = v.priceBases[0];
          return {
            id: v.id,
            label: v.label,
            attributes: v.attributes as Record<string, string>,
            baseValue: base?.baseValue ?? 0,
            floor: base?.floor ?? 0,
            ceiling: base?.ceiling ?? 0,
            effectiveAt: (base?.effectiveAt ?? new Date()).toISOString(),
          };
        }),
      };
    });
  }

  async updateMargin(categoryId: string, targetMargin: number): Promise<AdminCategoryDto[]> {
    const cat = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException("Category not found");
    await this.prisma.category.update({ where: { id: categoryId }, data: { targetMargin } });
    return this.categories();
  }

  async updateFeed(modelId: string, factor: number): Promise<AdminModelDto[]> {
    const model = await this.prisma.model.findUnique({ where: { id: modelId } });
    if (!model) throw new NotFoundException("Model not found");
    await this.prisma.marketFeed.upsert({
      where: { modelId },
      create: { modelId, factor },
      update: { factor },
    });
    return this.models(undefined);
  }

  /**
   * Versioned base-price edit: expire the current effective row and insert a new one,
   * so PriceBase keeps a full effective-dated history (engine reads the active row).
   */
  async updateVariantPrice(variantId: string, req: UpdateVariantPriceRequest) {
    const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException("Variant not found");

    const current = await this.prisma.priceBase.findFirst({
      where: { variantId, expiresAt: null },
      orderBy: { effectiveAt: "desc" },
    });

    await this.prisma.$transaction([
      ...(current
        ? [this.prisma.priceBase.update({ where: { id: current.id }, data: { expiresAt: new Date() } })]
        : []),
      this.prisma.priceBase.create({
        data: { variantId, baseValue: req.baseValue, floor: req.floor, ceiling: req.ceiling },
      }),
    ]);

    return { ok: true };
  }

  async bulkUpdate(req: BulkPriceRequest): Promise<BulkPriceResult> {
    let updated = 0;
    const errors: BulkPriceResult["errors"] = [];

    for (let i = 0; i < req.rows.length; i++) {
      const row = req.rows[i];
      try {
        const variant = await this.prisma.variant.findFirst({
          where: { label: row.variantLabel, model: { slug: row.modelSlug } },
        });
        if (!variant) {
          errors.push({ row: i + 1, message: `No variant "${row.variantLabel}" for model "${row.modelSlug}"` });
          continue;
        }
        if (row.floor > row.ceiling) {
          errors.push({ row: i + 1, message: "floor must be ≤ ceiling" });
          continue;
        }
        await this.updateVariantPrice(variant.id, {
          baseValue: row.baseValue,
          floor: row.floor,
          ceiling: row.ceiling,
        });
        updated += 1;
      } catch (e) {
        errors.push({ row: i + 1, message: e instanceof Error ? e.message : "failed" });
      }
    }
    return { updated, errors };
  }

  /** Live "what would this config quote right now" — bypasses the quote cache. */
  async simulate(variantId: string, conditions: ConditionSelection[]): Promise<SimulateResponse> {
    if (!variantId) throw new BadRequestException("variantId required");
    const priced = await this.pricing.price(variantId, conditions, { fresh: true });
    return {
      offer: priced.offer,
      currency: priced.currency,
      confidenceLow: priced.confidenceLow,
      confidenceHigh: priced.confidenceHigh,
      breakdown: priced.breakdown,
    };
  }
}

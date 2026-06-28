import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  ConditionKind,
  ModelCardDto,
  ModelDetailDto,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async listCategories() {
    const cats = await this.prisma.category.findMany({
      include: { _count: { select: { models: true } } },
      orderBy: { name: "asc" },
    });
    return cats.map((c) => ({ slug: c.slug, name: c.name, modelCount: c._count.models }));
  }

  /** Cards for the catalog grid + search. `q` does a case-insensitive contains match. */
  async listModels(q?: string, categorySlug?: string): Promise<ModelCardDto[]> {
    const models = await this.prisma.model.findMany({
      where: {
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { brand: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { brand: true, category: true },
      orderBy: { name: "asc" },
    });

    return Promise.all(
      models.map(async (m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        brand: m.brand.name,
        category: m.category.name,
        imageUrl: m.imageUrl,
        cashUpTo: await this.pricing.cashUpTo(m.id),
      })),
    );
  }

  async getModel(slug: string): Promise<ModelDetailDto> {
    const m = await this.prisma.model.findUnique({
      where: { slug },
      include: {
        brand: true,
        category: true,
        variants: true,
        conditionAttributes: { include: { options: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!m) throw new NotFoundException(`Model ${slug} not found`);

    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      brand: m.brand.name,
      category: m.category.name,
      imageUrl: m.imageUrl,
      cashUpTo: await this.pricing.cashUpTo(m.id),
      variants: m.variants.map((v) => ({
        id: v.id,
        label: v.label,
        attributes: v.attributes as Record<string, string>,
      })),
      conditionAttributes: m.conditionAttributes.map((a) => ({
        key: a.key,
        kind: a.kind as ConditionKind,
        label: a.label,
        helper: a.helper,
        options: a.options.map((o) => ({ key: o.key, label: o.label, helper: o.helper })),
      })),
    };
  }
}

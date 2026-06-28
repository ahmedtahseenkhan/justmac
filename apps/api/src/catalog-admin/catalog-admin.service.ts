import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminModelDetail,
  CatalogCategoryDto,
  CatalogModelRow,
  ConditionAttributeInput,
  CreateBrandRequest,
  CreateCategoryRequest,
  CreateModelRequest,
  UpdateModelRequest,
  UpdateVariantRequest,
  VariantInput,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";

@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /* ---- reads for the manager ---- */

  async categories(): Promise<CatalogCategoryDto[]> {
    const cats = await this.prisma.category.findMany({
      include: { brands: true },
      orderBy: { name: "asc" },
    });
    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      targetMargin: c.targetMargin,
      brands: c.brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name, categoryId: b.categoryId })),
    }));
  }

  async models(): Promise<CatalogModelRow[]> {
    const models = await this.prisma.model.findMany({
      include: { brand: true, category: true, _count: { select: { variants: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
    return Promise.all(
      models.map(async (m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        brand: m.brand.name,
        category: m.category.name,
        variantCount: m._count.variants,
        cashUpTo: await this.pricing.cashUpTo(m.id),
      })),
    );
  }

  /* ---- create ---- */

  async createCategory(req: CreateCategoryRequest) {
    await this.assertSlugFree("category", req.slug);
    return this.prisma.category.create({
      data: { slug: slugify(req.slug), name: req.name, targetMargin: req.targetMargin },
    });
  }

  async createBrand(req: CreateBrandRequest) {
    await this.assertSlugFree("brand", req.slug);
    const cat = await this.prisma.category.findUnique({ where: { id: req.categoryId } });
    if (!cat) throw new BadRequestException("Category not found.");
    return this.prisma.brand.create({
      data: { slug: slugify(req.slug), name: req.name, categoryId: req.categoryId },
    });
  }

  /** The headline: create a model with its variants, prices, and condition tree in one transaction. */
  async createModel(req: CreateModelRequest) {
    await this.assertSlugFree("model", req.slug);
    const [cat, brand] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: req.categoryId } }),
      this.prisma.brand.findUnique({ where: { id: req.brandId } }),
    ]);
    if (!cat) throw new BadRequestException("Category not found.");
    if (!brand) throw new BadRequestException("Brand not found.");
    assertUniqueKeys(req.variants.map((v) => v.label), "variant label");
    assertUniqueKeys(req.conditionAttributes.map((a) => a.key), "condition key");

    const model = await this.prisma.$transaction(async (tx) => {
      const m = await tx.model.create({
        data: {
          slug: slugify(req.slug),
          name: req.name,
          imageUrl: req.imageUrl ?? null,
          categoryId: req.categoryId,
          brandId: req.brandId,
        },
      });
      for (const v of req.variants) await this.insertVariant(tx, m.id, v);
      for (let i = 0; i < req.conditionAttributes.length; i++) {
        await this.insertCondition(tx, m.id, req.conditionAttributes[i], i);
      }
      return m;
    });
    return { id: model.id, slug: model.slug };
  }

  async addVariant(modelId: string, v: VariantInput) {
    const model = await this.prisma.model.findUnique({ where: { id: modelId } });
    if (!model) throw new NotFoundException("Model not found");
    await this.insertVariant(this.prisma, modelId, v);
    return { ok: true };
  }

  async addCondition(modelId: string, a: ConditionAttributeInput) {
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
      include: { conditionAttributes: true },
    });
    if (!model) throw new NotFoundException("Model not found");
    await this.insertCondition(this.prisma, modelId, a, model.conditionAttributes.length);
    return { ok: true };
  }

  /* ---- read one (for the editor) ---- */

  async modelDetail(id: string): Promise<AdminModelDetail> {
    const m = await this.prisma.model.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        variants: { include: { priceBases: { where: { expiresAt: null }, orderBy: { effectiveAt: "desc" }, take: 1 } } },
        conditionAttributes: { include: { options: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!m) throw new NotFoundException("Model not found");
    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      imageUrl: m.imageUrl,
      categoryId: m.categoryId,
      brandId: m.brandId,
      category: m.category.name,
      brand: m.brand.name,
      variants: m.variants.map((v) => {
        const b = v.priceBases[0];
        return {
          id: v.id,
          label: v.label,
          attributes: v.attributes as Record<string, string>,
          baseValue: b?.baseValue ?? 0,
          floor: b?.floor ?? 0,
          ceiling: b?.ceiling ?? 0,
        };
      }),
      conditionAttributes: m.conditionAttributes.map((a) => ({
        id: a.id,
        key: a.key,
        kind: a.kind as AdminModelDetail["conditionAttributes"][number]["kind"],
        label: a.label,
        helper: a.helper,
        options: a.options.map((o) => ({ key: o.key, label: o.label, helper: o.helper, multiplier: o.multiplier })),
      })),
    };
  }

  /* ---- edit ---- */

  async updateModel(id: string, req: UpdateModelRequest) {
    const model = await this.prisma.model.findUnique({ where: { id } });
    if (!model) throw new NotFoundException("Model not found");
    const [cat, brand] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: req.categoryId } }),
      this.prisma.brand.findUnique({ where: { id: req.brandId } }),
    ]);
    if (!cat) throw new BadRequestException("Category not found.");
    if (!brand) throw new BadRequestException("Brand not found.");
    await this.prisma.model.update({
      where: { id },
      data: { name: req.name, imageUrl: req.imageUrl ?? null, categoryId: req.categoryId, brandId: req.brandId },
    });
    return { ok: true };
  }

  /** Update a variant's label/attributes and (versioned) price. */
  async updateVariant(id: string, req: UpdateVariantRequest) {
    const variant = await this.prisma.variant.findUnique({
      where: { id },
      include: { priceBases: { where: { expiresAt: null }, orderBy: { effectiveAt: "desc" }, take: 1 } },
    });
    if (!variant) throw new NotFoundException("Variant not found");
    const current = variant.priceBases[0];
    const priceChanged =
      !current || current.baseValue !== req.baseValue || current.floor !== req.floor || current.ceiling !== req.ceiling;

    await this.prisma.$transaction([
      this.prisma.variant.update({ where: { id }, data: { label: req.label, attributes: req.attributes } }),
      ...(priceChanged && current
        ? [this.prisma.priceBase.update({ where: { id: current.id }, data: { expiresAt: new Date() } })]
        : []),
      ...(priceChanged
        ? [this.prisma.priceBase.create({ data: { variantId: id, baseValue: req.baseValue, floor: req.floor, ceiling: req.ceiling } })]
        : []),
    ]);
    return { ok: true };
  }

  async deleteVariant(id: string) {
    const variant = await this.prisma.variant.findUnique({
      where: { id },
      include: { quotes: { take: 1 }, model: { include: { _count: { select: { variants: true } } } } },
    });
    if (!variant) throw new NotFoundException("Variant not found");
    if (variant.quotes.length > 0) throw new BadRequestException("This configuration has quotes/orders and can't be deleted.");
    if (variant.model._count.variants <= 1) throw new BadRequestException("A model needs at least one configuration.");
    await this.prisma.$transaction([
      this.prisma.priceBase.deleteMany({ where: { variantId: id } }),
      this.prisma.variant.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /** Replace a condition attribute's label/kind and its full option set. */
  async updateCondition(id: string, a: ConditionAttributeInput) {
    const attr = await this.prisma.conditionAttribute.findUnique({ where: { id } });
    if (!attr) throw new NotFoundException("Condition not found");
    await this.prisma.$transaction([
      this.prisma.conditionOption.deleteMany({ where: { attributeId: id } }),
      this.prisma.conditionAttribute.update({
        where: { id },
        data: {
          kind: a.kind,
          label: a.label,
          helper: a.helper ?? null,
          options: {
            create: a.options.map((o, oi) => ({
              key: o.key,
              label: o.label,
              helper: o.helper ?? null,
              multiplier: o.multiplier,
              sortOrder: oi,
            })),
          },
        },
      }),
    ]);
    return { ok: true };
  }

  async deleteCondition(id: string) {
    const attr = await this.prisma.conditionAttribute.findUnique({
      where: { id },
      include: { model: { include: { _count: { select: { conditionAttributes: true } } } } },
    });
    if (!attr) throw new NotFoundException("Condition not found");
    if (attr.model._count.conditionAttributes <= 1) throw new BadRequestException("A model needs at least one condition question.");
    await this.prisma.$transaction([
      this.prisma.conditionOption.deleteMany({ where: { attributeId: id } }),
      this.prisma.conditionAttribute.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /* ---- delete (guarded against live references) ---- */

  async deleteModel(id: string) {
    const model = await this.prisma.model.findUnique({
      where: { id },
      include: { variants: { include: { quotes: { take: 1 } } }, conditionAttributes: { include: { options: true } } },
    });
    if (!model) throw new NotFoundException("Model not found");
    if (model.variants.some((v) => v.quotes.length > 0)) {
      throw new BadRequestException("This model has quotes/orders against it and can't be deleted.");
    }
    await this.prisma.$transaction(async (tx) => {
      for (const a of model.conditionAttributes) {
        await tx.conditionOption.deleteMany({ where: { attributeId: a.id } });
      }
      await tx.conditionAttribute.deleteMany({ where: { modelId: id } });
      for (const v of model.variants) {
        await tx.priceBase.deleteMany({ where: { variantId: v.id } });
      }
      await tx.variant.deleteMany({ where: { modelId: id } });
      await tx.marketFeed.deleteMany({ where: { modelId: id } });
      await tx.model.delete({ where: { id } });
    });
    return { ok: true };
  }

  /* ---- helpers ---- */

  private async insertVariant(tx: any, modelId: string, v: VariantInput) {
    if (v.floor > v.ceiling) throw new BadRequestException(`Variant "${v.label}": floor must be ≤ ceiling.`);
    const variant = await tx.variant.create({
      data: { modelId, label: v.label, attributes: v.attributes },
    });
    await tx.priceBase.create({
      data: { variantId: variant.id, baseValue: v.baseValue, floor: v.floor, ceiling: v.ceiling },
    });
  }

  private async insertCondition(tx: any, modelId: string, a: ConditionAttributeInput, sortOrder: number) {
    await tx.conditionAttribute.create({
      data: {
        modelId,
        key: a.key,
        kind: a.kind,
        label: a.label,
        helper: a.helper ?? null,
        sortOrder,
        options: {
          create: a.options.map((o, oi) => ({
            key: o.key,
            label: o.label,
            helper: o.helper ?? null,
            multiplier: o.multiplier,
            sortOrder: oi,
          })),
        },
      },
    });
  }

  private async assertSlugFree(entity: "category" | "brand" | "model", slug: string) {
    const s = slugify(slug);
    const found =
      entity === "category"
        ? await this.prisma.category.findUnique({ where: { slug: s } })
        : entity === "brand"
          ? await this.prisma.brand.findUnique({ where: { slug: s } })
          : await this.prisma.model.findUnique({ where: { slug: s } });
    if (found) throw new BadRequestException(`A ${entity} with slug "${s}" already exists.`);
  }
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function assertUniqueKeys(keys: string[], label: string) {
  if (new Set(keys).size !== keys.length) {
    throw new BadRequestException(`Duplicate ${label} in the submission.`);
  }
}

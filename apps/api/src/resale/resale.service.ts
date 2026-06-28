import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { customAlphabet } from "nanoid";
import type {
  ListDeviceRequest,
  ListingDto,
  MarginReport,
  RefurbItemDto,
  ResaleCheckoutRequest,
  SaleDto,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PromoService } from "../promo/promo.service";

const sku = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const saleRef = customAlphabet("0123456789", 12);

const GRADE_LABELS: Record<string, string> = {
  A: "Grade A — Excellent",
  B: "Grade B — Good",
  C: "Grade C — Fair",
};

@Injectable()
export class ResaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promo: PromoService,
  ) {}

  /** PAID devices that have been wiped/inspected but not yet listed for resale. */
  async refurbQueue(): Promise<RefurbItemDto[]> {
    const devices = await this.prisma.device.findMany({
      where: {
        listing: null,
        orderItem: { order: { state: "PAID" } },
      },
      include: { orderItem: { include: { order: true } } },
      orderBy: { createdAt: "asc" },
    });

    const out: RefurbItemDto[] = [];
    for (const d of devices) {
      const item = d.orderItem;
      const margin = await this.resaleMargin(item.modelSlug);
      out.push({
        deviceId: d.id,
        orderTrackingId: item.order.trackingId,
        modelName: item.modelName,
        modelSlug: item.modelSlug,
        variantLabel: item.variantLabel,
        serial: d.serial,
        acquisitionCost: item.offer,
        // Price that yields the category margin over what we paid.
        suggestedPrice: Math.round(item.offer / (1 - margin)),
      });
    }
    return out;
  }

  /** Refurbish + list an acquired device on the storefront. */
  async listDevice(deviceId: string, req: ListDeviceRequest): Promise<ListingDto> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { orderItem: { include: { order: true } }, listing: true },
    });
    if (!device) throw new NotFoundException("Device not found");
    if (device.listing) throw new BadRequestException("Device is already listed.");
    if (device.orderItem.order.state !== "PAID") {
      throw new BadRequestException("Only paid (acquired) devices can be listed.");
    }

    const item = device.orderItem;
    const listing = await this.prisma.listing.create({
      data: {
        sku: `RFB-${sku()}`,
        deviceId: device.id,
        title: `${item.modelName} ${item.variantLabel} · ${GRADE_LABELS[req.grade]}`,
        modelSlug: item.modelSlug,
        grade: req.grade,
        gradeLabel: GRADE_LABELS[req.grade],
        warrantyMonths: req.warrantyMonths,
        price: Math.round(req.price),
        acquisitionCost: item.offer,
        channel: req.channel,
        status: "LISTED",
      },
    });
    return toListingDto(listing);
  }

  /** Public storefront catalog — listed units, optionally filtered by category. */
  async shop(categorySlug?: string): Promise<ListingDto[]> {
    const listings = await this.prisma.listing.findMany({
      where: { status: "LISTED" },
      orderBy: { createdAt: "desc" },
    });
    if (!categorySlug) return listings.map(toListingDto);
    const slugs = await this.modelSlugsForCategory(categorySlug);
    return listings.filter((l) => slugs.has(l.modelSlug)).map(toListingDto);
  }

  async getListing(skuParam: string): Promise<ListingDto> {
    const listing = await this.prisma.listing.findUnique({ where: { sku: skuParam } });
    if (!listing) throw new NotFoundException("Listing not found");
    return toListingDto(listing);
  }

  /** Buy refurbished units. Applies a resale discount promo, marks listings SOLD. */
  async checkout(req: ResaleCheckoutRequest): Promise<SaleDto> {
    const listings = await this.prisma.listing.findMany({ where: { id: { in: req.listingIds } } });
    if (listings.length !== req.listingIds.length) {
      throw new BadRequestException("One or more listings were not found.");
    }
    for (const l of listings) {
      if (l.status !== "LISTED") throw new BadRequestException(`${l.sku} is no longer available.`);
    }

    const subtotal = listings.reduce((sum, l) => sum + l.price, 0);
    const categorySlugs = await this.categoriesForModels(listings.map((l) => l.modelSlug));
    const promo = await this.promo.evaluate(req.promoCode, {
      kind: "RESALE_DISCOUNT",
      subtotal,
      categorySlugs,
    });
    const discount = promo.valid ? promo.amount : 0;
    const total = subtotal - discount;
    const ref = `S-${saleRef()}`;

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          reference: ref,
          buyerEmail: req.buyerEmail,
          buyerName: req.buyerName,
          payMethod: req.payMethod,
          promoCode: promo.valid ? promo.code : null,
          discount,
          total,
          currency: "USD",
          items: { create: listings.map((l) => ({ listingId: l.id, price: l.price })) },
        },
        include: { items: { include: { listing: true } } },
      });
      await tx.listing.updateMany({
        where: { id: { in: req.listingIds } },
        data: { status: "SOLD", soldAt: new Date() },
      });
      return created;
    });

    return {
      id: sale.id,
      reference: sale.reference,
      buyerEmail: sale.buyerEmail,
      buyerName: sale.buyerName,
      payMethod: sale.payMethod as SaleDto["payMethod"],
      promoCode: sale.promoCode,
      discount: sale.discount,
      total: sale.total,
      currency: sale.currency,
      createdAt: sale.createdAt.toISOString(),
      items: sale.items.map((si) => ({
        listingId: si.listingId,
        sku: si.listing.sku,
        title: si.listing.title,
        price: si.price,
      })),
    };
  }

  /** Margin reporting: acquisition cost vs. resale revenue across sold units. */
  async margins(): Promise<MarginReport> {
    const [sold, listedCount] = await Promise.all([
      this.prisma.listing.findMany({ where: { status: "SOLD" }, orderBy: { soldAt: "desc" } }),
      this.prisma.listing.count({ where: { status: "LISTED" } }),
    ]);

    const revenue = sold.reduce((s, l) => s + l.price, 0);
    const acquisitionCost = sold.reduce((s, l) => s + l.acquisitionCost, 0);
    const grossMargin = revenue - acquisitionCost;

    return {
      unitsSold: sold.length,
      revenue,
      acquisitionCost,
      grossMargin,
      marginPct: revenue > 0 ? Math.round((grossMargin / revenue) * 1000) / 10 : 0,
      listedCount,
      currency: "USD",
      recent: sold.slice(0, 10).map((l) => ({
        sku: l.sku,
        title: l.title,
        acquisitionCost: l.acquisitionCost,
        price: l.price,
        margin: l.price - l.acquisitionCost,
        soldAt: (l.soldAt ?? l.createdAt).toISOString(),
      })),
    };
  }

  // --- helpers ---

  private async resaleMargin(modelSlug: string): Promise<number> {
    const model = await this.prisma.model.findUnique({
      where: { slug: modelSlug },
      include: { category: true },
    });
    return model?.category.targetMargin ?? 0.25;
  }

  private async modelSlugsForCategory(categorySlug: string): Promise<Set<string>> {
    const models = await this.prisma.model.findMany({
      where: { category: { slug: categorySlug } },
      select: { slug: true },
    });
    return new Set(models.map((m) => m.slug));
  }

  private async categoriesForModels(modelSlugs: string[]): Promise<string[]> {
    const models = await this.prisma.model.findMany({
      where: { slug: { in: modelSlugs } },
      include: { category: true },
    });
    return [...new Set(models.map((m) => m.category.slug))];
  }
}

function toListingDto(l: any): ListingDto {
  return {
    id: l.id,
    sku: l.sku,
    title: l.title,
    modelSlug: l.modelSlug,
    grade: l.grade,
    gradeLabel: l.gradeLabel,
    warrantyMonths: l.warrantyMonths,
    price: l.price,
    currency: "USD",
    status: l.status,
  };
}

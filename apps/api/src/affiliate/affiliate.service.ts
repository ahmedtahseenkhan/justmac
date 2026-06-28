import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AffiliateDto, CreateAffiliateRequest } from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AffiliateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(req: CreateAffiliateRequest): Promise<AffiliateDto> {
    const code = req.code.trim().toUpperCase();
    const exists = await this.prisma.affiliate.findUnique({ where: { code } });
    if (exists) throw new BadRequestException("Code already in use.");
    const a = await this.prisma.affiliate.create({
      data: { code, name: req.name, email: req.email, ratePct: req.ratePct },
    });
    return toDto(a, 0);
  }

  async list(): Promise<AffiliateDto[]> {
    const affiliates = await this.prisma.affiliate.findMany({
      include: { _count: { select: { conversions: true } } },
      orderBy: { earnings: "desc" },
    });
    return affiliates.map((a) => toDto(a, a._count.conversions));
  }

  async get(code: string): Promise<AffiliateDto> {
    const a = await this.prisma.affiliate.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { conversions: { orderBy: { createdAt: "desc" } } },
    });
    if (!a) throw new NotFoundException("Affiliate not found");
    return {
      ...toDto(a, a.conversions.length),
      conversions: a.conversions.map((c) => ({
        orderTrackingId: c.orderTrackingId,
        payoutBase: c.payoutBase,
        commission: c.commission,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  /** Track a referral click (for the tracked-link CTR). */
  async click(code: string): Promise<void> {
    await this.prisma.affiliate.updateMany({
      where: { code: code.trim().toUpperCase() },
      data: { clicks: { increment: 1 } },
    });
  }

  /**
   * Record a commission when a referred order is paid. Idempotent per order
   * (orderTrackingId is unique), so re-running settle never double-credits.
   */
  async recordConversion(args: { affiliateCode: string; orderTrackingId: string; payoutBase: number }): Promise<void> {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { code: args.affiliateCode.trim().toUpperCase() },
    });
    if (!affiliate) return;
    const existing = await this.prisma.affiliateConversion.findUnique({
      where: { orderTrackingId: args.orderTrackingId },
    });
    if (existing) return;

    const commission = Math.round((args.payoutBase * affiliate.ratePct) / 100);
    await this.prisma.$transaction([
      this.prisma.affiliateConversion.create({
        data: {
          affiliateId: affiliate.id,
          orderTrackingId: args.orderTrackingId,
          payoutBase: args.payoutBase,
          commission,
        },
      }),
      this.prisma.affiliate.update({
        where: { id: affiliate.id },
        data: { earnings: { increment: commission } },
      }),
    ]);
  }
}

function toDto(a: any, conversionCount: number): AffiliateDto {
  return {
    code: a.code,
    name: a.name,
    email: a.email,
    ratePct: a.ratePct,
    clicks: a.clicks,
    earnings: a.earnings,
    conversionCount,
    currency: "USD",
  };
}

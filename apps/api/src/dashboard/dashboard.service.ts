import { Injectable } from "@nestjs/common";
import { LIFECYCLE_STATES, type DashboardDto } from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<DashboardDto> {
    const [grouped, paid, soldListings, listingsLive, affiliates, b2bBatches, modelCount] = await Promise.all([
      this.prisma.order.groupBy({ by: ["state"], _count: { _all: true } }),
      this.prisma.order.aggregate({ where: { state: "PAID" }, _count: { _all: true }, _sum: { totalOffer: true } }),
      this.prisma.listing.findMany({ where: { status: "SOLD" }, select: { price: true, acquisitionCost: true } }),
      this.prisma.listing.count({ where: { status: "LISTED" } }),
      this.prisma.affiliate.aggregate({ _sum: { earnings: true } }),
      this.prisma.bulkBatch.count(),
      this.prisma.model.count(),
    ]);

    const ordersByState: Record<string, number> = {};
    for (const s of LIFECYCLE_STATES) ordersByState[s] = 0;
    for (const g of grouped) ordersByState[g.state] = g._count._all;

    const awaitingAction = (ordersByState.RECEIVED ?? 0) + (ordersByState.INSPECTING ?? 0) + (ordersByState.OFFER_ADJUSTED ?? 0);
    const revenue = soldListings.reduce((s, l) => s + l.price, 0);
    const cost = soldListings.reduce((s, l) => s + l.acquisitionCost, 0);
    const grossMargin = revenue - cost;

    return {
      ordersByState,
      awaitingAction,
      paidCount: paid._count._all,
      paidTotal: paid._sum.totalOffer ?? 0,
      listingsLive,
      unitsSold: soldListings.length,
      grossMargin,
      marginPct: revenue > 0 ? Math.round((grossMargin / revenue) * 1000) / 10 : 0,
      affiliateEarnings: affiliates._sum.earnings ?? 0,
      b2bBatches,
      modelCount,
      currency: "USD",
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { customAlphabet } from "nanoid";
import {
  canTransition,
  instantPayoutFee,
  type CreateOrderRequest,
  type LifecycleState,
  type OrderDto,
  type RespondRequest,
  type ScreeningResult,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PromoService } from "../promo/promo.service";
import { AffiliateService } from "../affiliate/affiliate.service";

const trackingId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly promo: PromoService,
    private readonly affiliate: AffiliateService,
  ) {}

  /** Turn a box of locked quotes into an order, issue a (stub) prepaid label. */
  async createOrder(req: CreateOrderRequest): Promise<OrderDto> {
    const quoteIds = req.items.map((i) => i.quoteId);
    const quotes = await this.prisma.quote.findMany({
      where: { id: { in: quoteIds } },
      include: { variant: { include: { model: { include: { category: true } } } }, orderItem: true },
    });

    if (quotes.length !== quoteIds.length) {
      throw new BadRequestException("One or more quotes were not found.");
    }
    for (const q of quotes) {
      if (q.orderItem) throw new BadRequestException(`Quote ${q.id} is already in an order.`);
      if (q.lockExpiresAt.getTime() < Date.now()) {
        throw new BadRequestException(`Quote ${q.id} has expired — please re-quote.`);
      }
    }

    const subtotal = quotes.reduce((sum, q) => sum + q.offer, 0);

    // Apply a buyback promo bonus if the code is valid for these categories.
    const categorySlugs = [...new Set(quotes.map((q) => q.variant.model.category.slug))];
    const promo = await this.promo.evaluate(req.promoCode, {
      kind: "BUYBACK_BONUS",
      subtotal,
      categorySlugs,
    });
    const promoBonus = promo.valid ? promo.amount : 0;
    const totalOffer = subtotal + promoBonus;
    const fee = req.instantPayout ? instantPayoutFee(totalOffer) : 0;

    const tid = trackingId();
    const labelUrl = `https://labels.sellme.local/${tid}.pdf`; // stub — real impl calls FedEx/UPS

    const order = await this.prisma.order.create({
      data: {
        trackingId: tid,
        email: req.email,
        fullName: req.fullName,
        payoutMethod: req.payoutMethod,
        payoutDetail: maskPayout(req.payoutDetail),
        shippingOption: req.shippingOption,
        promoCode: promo.valid ? promo.code : null,
        promoBonus,
        instantPayout: !!req.instantPayout,
        instantPayoutFee: fee,
        affiliateCode: req.affiliateCode?.trim().toUpperCase() || null,
        labelUrl,
        totalOffer,
        currency: quotes[0]?.currency ?? "USD",
        state: "LABEL_ISSUED",
        items: {
          create: quotes.map((q) => ({
            quoteId: q.id,
            modelName: q.variant.model.name,
            modelSlug: q.variant.model.slug,
            variantLabel: q.variant.label,
            offer: q.offer,
            state: "LABEL_ISSUED",
          })),
        },
        events: {
          create: [
            { state: "QUOTE_LOCKED", note: "Quote locked at checkout" },
            { state: "LABEL_ISSUED", note: "Prepaid shipping label issued" },
          ],
        },
      },
    });

    await this.notifications.notifyStateChange(order, "LABEL_ISSUED");
    return this.getByTracking(tid);
  }

  /** Searchable, paginated list of all orders for the back office. */
  async list(opts: { state?: string; q?: string; page?: number }): Promise<{
    orders: Array<{ trackingId: string; fullName: string; email: string; state: LifecycleState; totalOffer: number; itemCount: number; createdAt: string }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const pageSize = 20;
    const page = Math.max(1, opts.page ?? 1);
    const q = opts.q?.trim();
    const where = {
      ...(opts.state ? { state: opts.state } : {}),
      ...(q
        ? {
            OR: [
              { trackingId: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { fullName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      orders: rows.map((o) => ({
        trackingId: o.trackingId,
        fullName: o.fullName,
        email: o.email,
        state: o.state as LifecycleState,
        totalOffer: o.totalOffer,
        itemCount: o._count.items,
        createdAt: o.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Orders currently in the ops pipeline (post-shipping, pre-terminal), newest first. */
  async board(): Promise<OrderDto[]> {
    const active: LifecycleState[] = [
      "LABEL_ISSUED",
      "IN_TRANSIT",
      "RECEIVED",
      "INSPECTING",
      "OFFER_CONFIRMED",
      "OFFER_ADJUSTED",
      "ACCEPTED",
    ];
    const orders = await this.prisma.order.findMany({
      where: { state: { in: active } },
      include: {
        items: { include: { device: { include: { inspection: true } } } },
        notifications: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(toOrderDto);
  }

  async getByTracking(trackingIdParam: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { trackingId: trackingIdParam },
      include: {
        items: { include: { device: { include: { inspection: true } } } },
        notifications: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    return toOrderDto(order);
  }

  /**
   * Single transition entry point: validates the state machine, mirrors state to
   * items, writes an audit event, and fires notifications. Used by the demo control,
   * the ops back-office, and the Fair-Evaluation flow.
   */
  async advance(trackingIdParam: string, to: LifecycleState, note?: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { trackingId: trackingIdParam } });
    if (!order) throw new NotFoundException("Order not found");

    const from = order.state as LifecycleState;
    if (from === to) return this.getByTracking(trackingIdParam);
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Illegal transition ${from} → ${to}`);
    }

    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: order.id }, data: { state: to } }),
      this.prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { state: to } }),
      this.prisma.orderEvent.create({ data: { orderId: order.id, state: to, note } }),
    ]);
    await this.notifications.notifyStateChange(order, to);

    return this.getByTracking(trackingIdParam);
  }

  /**
   * Seller's Fair-Evaluation response after inspection.
   *  - ACCEPT from OFFER_CONFIRMED/OFFER_ADJUSTED → lock in the (adjusted) offer, pay out.
   *  - REJECT from OFFER_ADJUSTED → free return (REJECTED → RETURNED).
   */
  async respond(trackingIdParam: string, req: RespondRequest): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { trackingId: trackingIdParam },
      include: { items: { include: { device: { include: { inspection: true } } } } },
    });
    if (!order) throw new NotFoundException("Order not found");
    const state = order.state as LifecycleState;

    if (state !== "OFFER_CONFIRMED" && state !== "OFFER_ADJUSTED") {
      throw new BadRequestException(`Order ${trackingIdParam} has no offer awaiting a response.`);
    }

    if (req.decision === "REJECT") {
      if (state !== "OFFER_ADJUSTED") {
        throw new BadRequestException("Only an adjusted offer can be rejected.");
      }
      await this.advance(trackingIdParam, "REJECTED", "Seller rejected the adjusted offer");
      return this.advance(trackingIdParam, "RETURNED", "Free return shipment created");
    }

    // ACCEPT — if the offer was adjusted, commit the adjusted amounts.
    if (state === "OFFER_ADJUSTED") {
      const updates = order.items
        .filter((it) => it.device?.inspection?.adjustedOffer != null)
        .map((it) =>
          this.prisma.orderItem.update({
            where: { id: it.id },
            data: { offer: it.device!.inspection!.adjustedOffer! },
          }),
        );
      const newTotal = order.items.reduce(
        (sum, it) => sum + (it.device?.inspection?.adjustedOffer ?? it.offer),
        0,
      );
      await this.prisma.$transaction([
        ...updates,
        this.prisma.order.update({ where: { id: order.id }, data: { totalOffer: newTotal } }),
      ]);
    }

    await this.advance(trackingIdParam, "ACCEPTED", "Seller accepted the offer");
    return this.settleAndPay(trackingIdParam);
  }

  /** Idempotent payout + final transition to PAID. */
  private async settleAndPay(trackingIdParam: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { trackingId: trackingIdParam } });
    if (!order) throw new NotFoundException("Order not found");

    // Instant payout deducts a fee; the seller receives the net amount.
    const netPayout = order.totalOffer - order.instantPayoutFee;

    // reference = order id → re-running this never double-pays.
    await this.prisma.payout.upsert({
      where: { reference: order.id },
      create: {
        orderId: order.id,
        rail: order.payoutMethod,
        amount: netPayout,
        status: "SENT",
        reference: order.id,
      },
      update: {},
    });

    // Credit the referring affiliate (idempotent per order).
    if (order.affiliateCode) {
      await this.affiliate.recordConversion({
        affiliateCode: order.affiliateCode,
        orderTrackingId: order.trackingId,
        payoutBase: order.totalOffer,
      });
    }

    const note = order.instantPayout
      ? `Same-day payout sent (fee −$${order.instantPayoutFee})`
      : "Payout sent";
    return this.advance(trackingIdParam, "PAID", note);
  }
}

function maskPayout(detail: string): string {
  const trimmed = detail.trim();
  if (trimmed.length <= 4) return "••••";
  return "••••" + trimmed.slice(-4);
}

function toOrderDto(order: any): OrderDto {
  const proposedTotal =
    order.state === "OFFER_ADJUSTED"
      ? order.items.reduce(
          (sum: number, it: any) => sum + (it.device?.inspection?.adjustedOffer ?? it.offer),
          0,
        )
      : null;

  return {
    id: order.id,
    trackingId: order.trackingId,
    email: order.email,
    fullName: order.fullName,
    payoutMethod: order.payoutMethod,
    shippingOption: order.shippingOption,
    labelUrl: order.labelUrl,
    totalOffer: order.totalOffer,
    proposedTotal,
    promoCode: order.promoCode,
    promoBonus: order.promoBonus,
    instantPayout: order.instantPayout,
    instantPayoutFee: order.instantPayoutFee,
    affiliateCode: order.affiliateCode,
    currency: order.currency,
    state: order.state,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((it: any) => ({
      id: it.id,
      modelName: it.modelName,
      modelSlug: it.modelSlug,
      variantLabel: it.variantLabel,
      offer: it.offer,
      state: it.state,
      device: it.device
        ? {
            id: it.device.id,
            serial: it.device.serial,
            imei: it.device.imei,
            eligible: it.device.eligible,
            screening: (it.device.screening as ScreeningResult) ?? null,
            inspection: it.device.inspection
              ? {
                  inspector: it.device.inspection.inspector,
                  findings: it.device.inspection.findings,
                  outcome: it.device.inspection.outcome,
                  adjustedOffer: it.device.inspection.adjustedOffer,
                  createdAt: it.device.inspection.createdAt.toISOString(),
                }
              : null,
          }
        : null,
    })),
    notifications: (order.notifications ?? []).map((n: any) => ({
      id: n.id,
      channel: n.channel,
      subject: n.subject,
      body: n.body,
      state: n.state,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

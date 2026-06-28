import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  InspectRequest,
  IntakeRequest,
  LifecycleState,
  OrderDto,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { ScreeningService } from "../screening/screening.service";
import { PricingService } from "../pricing/pricing.service";

// Forward happy-path used to walk an order to a target state via valid single hops.
const CHAIN: LifecycleState[] = [
  "QUOTE_LOCKED",
  "LABEL_ISSUED",
  "IN_TRANSIT",
  "RECEIVED",
  "INSPECTING",
];

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly screening: ScreeningService,
    private readonly pricing: PricingService,
  ) {}

  /** The grading board — everything in flight that ops can act on. */
  queue(): Promise<OrderDto[]> {
    return this.orders.board();
  }

  /**
   * Receive a shipment by tracking number. Creates a physical Device per item, runs
   * eligibility/fraud screening, and moves the order to RECEIVED.
   */
  async intake(trackingId: string, req: IntakeRequest): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { trackingId },
      include: { items: { include: { device: true } } },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (!["LABEL_ISSUED", "IN_TRANSIT"].includes(order.state)) {
      throw new BadRequestException(`Order is ${order.state}; cannot intake.`);
    }

    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      if (item.device) continue;
      // Single-device boxes are the norm; suffix extra units so serials stay unique.
      const serial = i === 0 ? req.serial : `${req.serial}-${i + 1}`;
      const result = await this.screening.screen({
        serial,
        imei: req.imei,
        declaredModelName: item.modelName,
      });
      await this.prisma.device.create({
        data: {
          orderItemId: item.id,
          serial,
          imei: req.imei,
          eligible: result.eligible,
          screening: result as object,
        },
      });
    }

    return this.advanceTo(trackingId, "RECEIVED", "Shipment received & scanned");
  }

  /**
   * Grade one device. Re-prices against the inspector's actual condition grades and
   * decides CONFIRMED (matches/beats quote) vs ADJUSTED (worse than quoted). When every
   * device in the order is graded, moves the order to the matching offer state.
   */
  async inspect(orderItemId: string, req: InspectRequest): Promise<OrderDto> {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { device: true, quote: true, order: true },
    });
    if (!item) throw new NotFoundException("Order item not found");
    if (!item.device) throw new BadRequestException("Run intake before inspecting this item.");

    const repriced = await this.pricing.price(item.quote.variantId, req.gradedConditions);
    const confirmed = repriced.offer >= item.offer;
    const adjustedOffer = confirmed ? item.offer : repriced.offer;
    const outcome = confirmed ? "CONFIRMED" : "ADJUSTED";

    await this.prisma.inspection.upsert({
      where: { deviceId: item.device.id },
      create: {
        deviceId: item.device.id,
        inspector: req.inspector,
        findings: req.findings,
        gradedConditions: req.gradedConditions as object,
        adjustedOffer,
        outcome,
      },
      update: {
        inspector: req.inspector,
        findings: req.findings,
        gradedConditions: req.gradedConditions as object,
        adjustedOffer,
        outcome,
      },
    });
    // Data wipe happens at grading — record the (stub) NIST erase certificate.
    await this.prisma.device.update({
      where: { id: item.device.id },
      data: { wipeCertUrl: `https://certs.sellme.local/wipe/${item.device.id}.pdf` },
    });

    // Ensure the order is in INSPECTING, then settle the order outcome once all graded.
    await this.advanceTo(item.order.trackingId, "INSPECTING", "Grading started");

    const items = await this.prisma.orderItem.findMany({
      where: { orderId: item.orderId },
      include: { device: { include: { inspection: true } } },
    });
    const allGraded = items.every((it) => it.device?.inspection);
    if (allGraded) {
      const anyAdjusted = items.some((it) => it.device?.inspection?.outcome === "ADJUSTED");
      await this.orders.advance(
        item.order.trackingId,
        anyAdjusted ? "OFFER_ADJUSTED" : "OFFER_CONFIRMED",
        anyAdjusted ? "Inspection adjusted the offer" : "Inspection confirmed the offer",
      );
    }

    return this.orders.getByTracking(item.order.trackingId);
  }

  /** Advance along the happy path to `target` via valid single-step transitions. */
  private async advanceTo(trackingId: string, target: LifecycleState, note?: string): Promise<OrderDto> {
    let order = await this.orders.getByTracking(trackingId);
    const targetIdx = CHAIN.indexOf(target);
    let curIdx = CHAIN.indexOf(order.state as LifecycleState);
    if (targetIdx < 0 || curIdx < 0) {
      throw new BadRequestException(`Cannot walk ${order.state} → ${target}`);
    }
    while (curIdx < targetIdx) {
      curIdx += 1;
      order = await this.orders.advance(trackingId, CHAIN[curIdx], curIdx === targetIdx ? note : undefined);
    }
    return order;
  }
}

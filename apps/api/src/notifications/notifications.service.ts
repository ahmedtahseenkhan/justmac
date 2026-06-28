import { Injectable, Logger } from "@nestjs/common";
import { LIFECYCLE_LABELS, type LifecycleState } from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";

interface OrderForNotify {
  id: string;
  trackingId: string;
  email: string;
  fullName: string;
}

// Per-state copy. Only states worth pinging the seller about get a template.
const TEMPLATES: Partial<Record<LifecycleState, (o: OrderForNotify) => { subject: string; body: string }>> = {
  LABEL_ISSUED: (o) => ({
    subject: "Your prepaid shipping label is ready",
    body: `Hi ${o.fullName}, your label for trade-in ${o.trackingId} is attached. Pack your device and drop it off.`,
  }),
  IN_TRANSIT: (o) => ({
    subject: "We're tracking your shipment",
    body: `Trade-in ${o.trackingId} is on its way to us. We'll email you the moment it arrives.`,
  }),
  RECEIVED: (o) => ({
    subject: "We received your device",
    body: `Good news — we received your device for trade-in ${o.trackingId}. Inspection is next.`,
  }),
  INSPECTING: (o) => ({
    subject: "Your device is being inspected",
    body: `Our team is grading your device for trade-in ${o.trackingId}. This usually takes 1 business day.`,
  }),
  OFFER_CONFIRMED: (o) => ({
    subject: "Your offer is confirmed 🎉",
    body: `Inspection matched your quote for ${o.trackingId}. We're processing your payout now.`,
  }),
  OFFER_ADJUSTED: (o) => ({
    subject: "Action needed: your offer was adjusted",
    body: `Inspection found your device differs from the quote on ${o.trackingId}. Review the new offer and accept, or reject for a free return (our Fair-Evaluation Promise).`,
  }),
  ACCEPTED: (o) => ({
    subject: "Offer accepted — payout on the way",
    body: `Thanks ${o.fullName}! You accepted the offer for ${o.trackingId}. Your payout is being sent.`,
  }),
  PAID: (o) => ({
    subject: "You've been paid 💸",
    body: `Your payout for trade-in ${o.trackingId} is on its way via your chosen method. Thank you!`,
  }),
  REJECTED: (o) => ({
    subject: "We'll return your device",
    body: `You rejected the adjusted offer for ${o.trackingId}. No problem — we're shipping your device back free of charge.`,
  }),
  RETURNED: (o) => ({
    subject: "Your device is on its way back",
    body: `Trade-in ${o.trackingId}: your device has been shipped back to you with free return shipping.`,
  }),
};

/**
 * Transactional notifications. Providers (email/SMS) are stubbed to a logger in MVP;
 * every send is persisted so the seller sees an activity feed and ops can audit it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire email + SMS for a state change. No-op for states without a template. */
  async notifyStateChange(order: OrderForNotify, state: LifecycleState): Promise<void> {
    const tpl = TEMPLATES[state];
    if (!tpl) return;
    const { subject, body } = tpl(order);

    // Email + an SMS-sized variant. Real impl swaps the logger for SES/Twilio.
    const sms = `${subject} — ${LIFECYCLE_LABELS[state]} · ${order.trackingId}`;
    for (const [channel, to, text] of [
      ["EMAIL", order.email, body],
      ["SMS", "+1•••••••" /* masked phone in MVP */, sms],
    ] as const) {
      this.logger.log(`[${channel} → ${to}] ${subject}`);
      await this.prisma.notification.create({
        data: { orderId: order.id, channel, to, subject, body: text, state },
      });
    }
  }
}

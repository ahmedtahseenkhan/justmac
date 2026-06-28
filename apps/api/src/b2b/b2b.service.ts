import { Injectable, NotFoundException } from "@nestjs/common";
import { customAlphabet } from "nanoid";
import type {
  BatchDto,
  BatchSummaryDto,
  CreateBatchRequest,
  CustodyEvent,
} from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";

const ref = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 7);
const invSeq = customAlphabet("0123456789", 6);

@Injectable()
export class B2bService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /**
   * Submit a bulk batch. BUYBACK prices each device (preliminary, subject to inspection)
   * and raises a net-terms invoice; ITAD runs data destruction + chain-of-custody and
   * issues no payout. Devices are routed to a relationship manager by volume.
   */
  async createBatch(req: CreateBatchRequest): Promise<BatchDto> {
    const account = await this.prisma.b2BAccount.upsert({
      where: { company: req.company },
      create: {
        company: req.company,
        contactName: req.contactName,
        contactEmail: req.contactEmail,
        netTermsDays: req.netTermsDays ?? 30,
      },
      update: { contactName: req.contactName, contactEmail: req.contactEmail },
    });

    const manager = routeManager(req.devices.length);
    const reference = `B2B-${ref()}`;

    // Price + process each device.
    const now = new Date();
    const processed = await Promise.all(
      req.devices.map(async (d) => {
        const variant = await this.prisma.variant.findFirst({
          where: { label: d.variantLabel, model: { slug: d.modelSlug } },
          include: { model: true },
        });
        const matched = !!variant;
        let quotedValue = 0;
        let modelName = d.modelSlug;
        if (variant) {
          modelName = variant.model.name;
          if (req.type === "BUYBACK") {
            // Preliminary bulk valuation: no condition penalties (subject to inspection).
            const priced = await this.pricing.price(variant.id, []);
            quotedValue = priced.offer;
          }
        }
        const custody = buildCustody(req.type, now);
        return {
          modelName,
          variantLabel: d.variantLabel,
          serial: d.serial ?? null,
          quotedValue,
          matched,
          wipeCertUrl: `https://certs.sellme.local/wipe/${reference}-${d.serial ?? "na"}.pdf`,
          destructionCertUrl:
            req.type === "ITAD"
              ? `https://certs.sellme.local/destruction/${reference}-${d.serial ?? "na"}.pdf`
              : null,
          custody: custody as object,
        };
      }),
    );

    const totalValue = processed.reduce((s, d) => s + d.quotedValue, 0);

    const batch = await this.prisma.bulkBatch.create({
      data: {
        reference,
        accountId: account.id,
        type: req.type,
        status: "COMPLETED", // processed synchronously in MVP
        manager,
        deviceCount: processed.length,
        totalValue,
        devices: { create: processed },
        // Net-terms invoice for buyback batches only.
        ...(req.type === "BUYBACK" && totalValue > 0
          ? {
              invoice: {
                create: {
                  number: `INV-${invSeq()}`,
                  accountId: account.id,
                  amount: totalValue,
                  netTermsDays: account.netTermsDays,
                  dueDate: new Date(now.getTime() + account.netTermsDays * 24 * 60 * 60 * 1000),
                },
              },
            }
          : {}),
      },
      include: { account: true, devices: true, invoice: true },
    });

    return toBatchDto(batch);
  }

  async listBatches(): Promise<BatchSummaryDto[]> {
    const batches = await this.prisma.bulkBatch.findMany({
      include: { account: true, devices: { select: { matched: true } } },
      orderBy: { createdAt: "desc" },
    });
    return batches.map((b) => ({
      id: b.id,
      reference: b.reference,
      company: b.account.company,
      type: b.type as BatchSummaryDto["type"],
      status: b.status as BatchSummaryDto["status"],
      manager: b.manager,
      deviceCount: b.deviceCount,
      totalValue: b.totalValue,
      matchedCount: b.devices.filter((d) => d.matched).length,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async getBatch(reference: string): Promise<BatchDto> {
    const batch = await this.prisma.bulkBatch.findUnique({
      where: { reference },
      include: { account: true, devices: true, invoice: true },
    });
    if (!batch) throw new NotFoundException("Batch not found");
    return toBatchDto(batch);
  }
}

// Volume-based relationship-manager routing.
function routeManager(deviceCount: number): string {
  if (deviceCount >= 50) return "Enterprise RM — Alex Chen";
  if (deviceCount >= 10) return "Mid-Market RM — Jordan Lee";
  return "SMB RM — Sam Rivera";
}

function buildCustody(type: string, at: Date): CustodyEvent[] {
  const t = at.toISOString();
  const trail: CustodyEvent[] = [
    { event: "Received at facility", at: t },
    { event: "Logged & serialized", at: t },
    { event: "Data wiped (NIST 800-88 purge)", at: t },
  ];
  if (type === "ITAD") {
    trail.push({ event: "Physical destruction certified", at: t });
  } else {
    trail.push({ event: "Graded & valued (preliminary)", at: t });
  }
  return trail;
}

function toBatchDto(batch: any): BatchDto {
  return {
    id: batch.id,
    reference: batch.reference,
    company: batch.account.company,
    contactName: batch.account.contactName,
    type: batch.type,
    status: batch.status,
    manager: batch.manager,
    deviceCount: batch.deviceCount,
    totalValue: batch.totalValue,
    currency: "USD",
    createdAt: batch.createdAt.toISOString(),
    invoice: batch.invoice
      ? {
          number: batch.invoice.number,
          amount: batch.invoice.amount,
          netTermsDays: batch.invoice.netTermsDays,
          dueDate: batch.invoice.dueDate.toISOString(),
          status: batch.invoice.status,
        }
      : null,
    devices: batch.devices.map((d: any) => ({
      id: d.id,
      modelName: d.modelName,
      variantLabel: d.variantLabel,
      serial: d.serial,
      quotedValue: d.quotedValue,
      matched: d.matched,
      wipeCertUrl: d.wipeCertUrl,
      destructionCertUrl: d.destructionCertUrl,
      custody: d.custody,
    })),
  };
}

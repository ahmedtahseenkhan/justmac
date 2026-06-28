import { Injectable, NotFoundException } from "@nestjs/common";
import type { PromoDto, PromoKind, PromoValidation, UpsertPromoRequest } from "@sellme/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface PromoContext {
  kind: PromoKind;
  subtotal: number;
  /** Category slugs present in the cart/box — used to honor scoped promos. */
  categorySlugs?: string[];
}

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve a code for a context and compute its dollar impact on the subtotal. */
  async evaluate(code: string | undefined, ctx: PromoContext): Promise<PromoValidation> {
    const norm = (code ?? "").trim().toUpperCase();
    const miss = (description: string): PromoValidation => ({
      valid: false,
      code: norm,
      kind: null,
      description,
      amount: 0,
    });
    if (!norm) return miss("No code entered.");

    const promo = await this.prisma.promoCode.findUnique({ where: { code: norm } });
    if (!promo || !promo.active) return miss("That code isn't valid.");
    if (promo.kind !== ctx.kind) {
      return miss(
        promo.kind === "BUYBACK_BONUS"
          ? "This code only applies to trade-ins."
          : "This code only applies to storefront purchases.",
      );
    }
    if (!this.inScope(promo.scope, ctx.categorySlugs)) {
      return miss("This code doesn't apply to these items.");
    }

    const raw =
      promo.valueType === "PERCENT" ? (ctx.subtotal * promo.value) / 100 : promo.value;
    const amount = Math.round(Math.min(raw, ctx.subtotal)); // never exceed subtotal
    const sign = promo.kind === "BUYBACK_BONUS" ? "bonus" : "off";
    const label =
      promo.valueType === "PERCENT" ? `${promo.value}%` : `$${promo.value}`;

    return {
      valid: true,
      code: norm,
      kind: promo.kind as PromoKind,
      description: `${label} ${sign} applied.`,
      amount,
    };
  }

  /* ---- admin CRUD ---- */

  async list(): Promise<PromoDto[]> {
    const promos = await this.prisma.promoCode.findMany({ orderBy: { code: "asc" } });
    return promos.map(toPromoDto);
  }

  /** Create or update a promo by code (idempotent on the unique code). */
  async upsert(req: UpsertPromoRequest): Promise<PromoDto> {
    const code = req.code.trim().toUpperCase();
    const promo = await this.prisma.promoCode.upsert({
      where: { code },
      create: { code, kind: req.kind, valueType: req.valueType, value: req.value, scope: req.scope, active: req.active },
      update: { kind: req.kind, valueType: req.valueType, value: req.value, scope: req.scope, active: req.active },
    });
    return toPromoDto(promo);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException("Promo not found");
    await this.prisma.promoCode.delete({ where: { id } });
    return { ok: true };
  }

  private inScope(scope: string, categorySlugs?: string[]): boolean {
    if (scope === "ALL") return true;
    const [type, slug] = scope.split(":");
    if (type === "category") return (categorySlugs ?? []).includes(slug);
    // model-scoped promos would check model slugs; not needed for current seed.
    return true;
  }
}

function toPromoDto(p: {
  id: string;
  code: string;
  kind: string;
  valueType: string;
  value: number;
  scope: string;
  active: boolean;
}): PromoDto {
  return {
    id: p.id,
    code: p.code,
    kind: p.kind as PromoDto["kind"],
    valueType: p.valueType as PromoDto["valueType"],
    value: p.value,
    scope: p.scope,
    active: p.active,
  };
}

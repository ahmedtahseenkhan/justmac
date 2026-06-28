import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { upsertPromoSchema, type PromoKind, type UpsertPromoRequest } from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PromoService } from "./promo.service";

@Controller("promo")
export class PromoController {
  constructor(private readonly promo: PromoService) {}

  // Public: lightweight validate for checkout UIs.
  @Get("validate")
  validate(
    @Query("code") code: string,
    @Query("kind") kind: PromoKind,
    @Query("subtotal") subtotal: string,
    @Query("categories") categories?: string,
  ) {
    return this.promo.evaluate(code, {
      kind: kind ?? "BUYBACK_BONUS",
      subtotal: Number(subtotal ?? 0),
      categorySlugs: categories ? categories.split(",").filter(Boolean) : [],
    });
  }
}

// Promo management — admin only.
@Controller("admin/promos")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class PromoAdminController {
  constructor(private readonly promo: PromoService) {}

  @Get()
  list() {
    return this.promo.list();
  }

  @Post()
  upsert(@Body(new ZodValidationPipe(upsertPromoSchema)) body: UpsertPromoRequest) {
    return this.promo.upsert(body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.promo.remove(id);
  }
}

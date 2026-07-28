import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import {
  decideProposalSchema,
  updateMarketSyncConfigSchema,
  upsertMarketLinkSchema,
  type DecideProposalRequest,
  type UpdateMarketSyncConfigRequest,
  type UpsertMarketLinkRequest,
} from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { MarketPriceService } from "./market-price.service";

// Marketplace price feed (Back Market / Gazelle / plug.tech) — admin only.
@Controller("admin/market-prices")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class MarketPriceController {
  constructor(private readonly market: MarketPriceService) {}

  @Get("overview")
  overview() {
    return this.market.overview();
  }

  @Put("config")
  updateConfig(
    @Body(new ZodValidationPipe(updateMarketSyncConfigSchema)) body: UpdateMarketSyncConfigRequest,
  ) {
    return this.market.updateConfig(body);
  }

  @Get("links/:variantId/suggest")
  suggest(@Param("variantId") variantId: string) {
    return this.market.suggestLinks(variantId);
  }

  @Put("links/:variantId")
  upsertLink(
    @Param("variantId") variantId: string,
    @Body(new ZodValidationPipe(upsertMarketLinkSchema)) body: UpsertMarketLinkRequest,
  ) {
    return this.market.upsertLink(variantId, body);
  }

  @Delete("links/:variantId")
  deleteLink(@Param("variantId") variantId: string) {
    return this.market.deleteLink(variantId);
  }

  @Post("run")
  run() {
    return this.market.runSync();
  }

  @Post("auto-match")
  autoMatch() {
    return this.market.autoMatchAll();
  }

  @Post("links/:variantId/verify")
  verifyLink(@Param("variantId") variantId: string, @CurrentUser() user: JwtPayload) {
    return this.market.verifyLink(variantId, user.email);
  }

  @Post("links/:variantId/refresh")
  refreshOne(@Param("variantId") variantId: string) {
    return this.market.runSync(variantId);
  }

  @Post("proposals/:id/decide")
  decide(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(decideProposalSchema)) body: DecideProposalRequest,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.market.decideProposal(id, body.decision, user.email);
  }
}

import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import {
  bulkPriceRequestSchema,
  quoteRequestSchema,
  updateFeedSchema,
  updateMarginSchema,
  updateVariantPriceSchema,
  type BulkPriceRequest,
  type QuoteRequest,
  type UpdateFeedRequest,
  type UpdateMarginRequest,
  type UpdateVariantPriceRequest,
} from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AdminService } from "./admin.service";

// Pricing console — admin only.
@Controller("admin/pricing")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("categories")
  categories() {
    return this.admin.categories();
  }

  @Get("models")
  models(@Query("category") category?: string) {
    return this.admin.models(category);
  }

  @Put("categories/:id/margin")
  updateMargin(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateMarginSchema)) body: UpdateMarginRequest,
  ) {
    return this.admin.updateMargin(id, body.targetMargin);
  }

  @Put("models/:id/feed")
  updateFeed(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateFeedSchema)) body: UpdateFeedRequest,
  ) {
    return this.admin.updateFeed(id, body.factor);
  }

  @Put("variants/:id/price")
  updateVariantPrice(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateVariantPriceSchema)) body: UpdateVariantPriceRequest,
  ) {
    return this.admin.updateVariantPrice(id, body);
  }

  @Post("bulk")
  bulk(@Body(new ZodValidationPipe(bulkPriceRequestSchema)) body: BulkPriceRequest) {
    return this.admin.bulkUpdate(body);
  }

  @Post("simulate")
  simulate(@Body(new ZodValidationPipe(quoteRequestSchema)) body: QuoteRequest) {
    return this.admin.simulate(body.variantId, body.conditions);
  }
}

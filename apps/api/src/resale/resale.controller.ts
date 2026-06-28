import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  listDeviceRequestSchema,
  resaleCheckoutSchema,
  type ListDeviceRequest,
  type ResaleCheckoutRequest,
} from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ResaleService } from "./resale.service";

@Controller()
export class ResaleController {
  constructor(private readonly resale: ResaleService) {}

  // Public storefront
  @Get("shop")
  shop(@Query("category") category?: string) {
    return this.resale.shop(category);
  }

  @Get("shop/:sku")
  listing(@Param("sku") sku: string) {
    return this.resale.getListing(sku);
  }

  @Post("resale/checkout")
  checkout(@Body(new ZodValidationPipe(resaleCheckoutSchema)) body: ResaleCheckoutRequest) {
    return this.resale.checkout(body);
  }

  // Ops / back-office — staff or admin only.
  @Get("resale/refurb-queue")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPS_STAFF")
  refurbQueue() {
    return this.resale.refurbQueue();
  }

  @Post("resale/devices/:deviceId/list")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPS_STAFF")
  listDevice(
    @Param("deviceId") deviceId: string,
    @Body(new ZodValidationPipe(listDeviceRequestSchema)) body: ListDeviceRequest,
  ) {
    return this.resale.listDevice(deviceId, body);
  }

  @Get("resale/margins")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPS_STAFF")
  margins() {
    return this.resale.margins();
  }
}

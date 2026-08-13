import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  adjustOfferSchema,
  inspectRequestSchema,
  intakeRequestSchema,
  type AdjustOfferRequest,
  type InspectRequest,
  type IntakeRequest,
} from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { OpsService } from "./ops.service";

// Back-office grading — staff or admin only.
@Controller("ops")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "OPS_STAFF")
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get("queue")
  queue() {
    return this.ops.queue();
  }

  @Post("orders/:trackingId/intake")
  intake(
    @Param("trackingId") trackingId: string,
    @Body(new ZodValidationPipe(intakeRequestSchema)) body: IntakeRequest,
  ) {
    return this.ops.intake(trackingId, body);
  }

  @Post("orders/:trackingId/adjust")
  adjust(
    @Param("trackingId") trackingId: string,
    @Body(new ZodValidationPipe(adjustOfferSchema)) body: AdjustOfferRequest,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ops.adjustOffer(trackingId, body, user.email);
  }

  @Post("items/:orderItemId/inspect")
  inspect(
    @Param("orderItemId") orderItemId: string,
    @Body(new ZodValidationPipe(inspectRequestSchema)) body: InspectRequest,
  ) {
    return this.ops.inspect(orderItemId, body);
  }
}

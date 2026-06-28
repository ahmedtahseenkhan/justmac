import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import {
  createOrderSchema,
  respondRequestSchema,
  LIFECYCLE_STATES,
  type CreateOrderRequest,
  type RespondRequest,
} from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { OrdersService } from "./orders.service";

const advanceSchema = z.object({
  to: z.enum(LIFECYCLE_STATES),
  note: z.string().optional(),
});
type AdvanceRequest = z.infer<typeof advanceSchema>;

@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Public: a seller places a trade-in at checkout.
  @Post()
  create(@Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderRequest) {
    return this.orders.createOrder(body);
  }

  // Back-office: searchable list of all orders (admin + staff).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPS_STAFF")
  list(
    @Query("state") state?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
  ) {
    return this.orders.list({ state, q, page: page ? Number(page) : 1 });
  }

  // Public: a seller looks up their order by tracking ID.
  @Get(":trackingId")
  track(@Param("trackingId") trackingId: string) {
    return this.orders.getByTracking(trackingId);
  }

  // Back-office: walk the lifecycle forward.
  @Post(":trackingId/advance")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPS_STAFF")
  advance(
    @Param("trackingId") trackingId: string,
    @Body(new ZodValidationPipe(advanceSchema)) body: AdvanceRequest,
  ) {
    return this.orders.advance(trackingId, body.to, body.note);
  }

  // Public: seller's Fair-Evaluation response to a confirmed/adjusted offer.
  @Post(":trackingId/respond")
  respond(
    @Param("trackingId") trackingId: string,
    @Body(new ZodValidationPipe(respondRequestSchema)) body: RespondRequest,
  ) {
    return this.orders.respond(trackingId, body);
  }
}

import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { createPriceWatchSchema, type CreatePriceWatchRequest } from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PriceWatchService } from "./price-watch.service";

@Controller("price-watch")
export class PriceWatchController {
  constructor(private readonly watch: PriceWatchService) {}

  // Public: a customer creates a watch from a quote's offer screen.
  @Post()
  create(@Body(new ZodValidationPipe(createPriceWatchSchema)) body: CreatePriceWatchRequest) {
    return this.watch.create(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  list(@Query("email") email?: string) {
    return this.watch.list(email);
  }

  // Stands in for a scheduled checker job.
  @Post("run")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  run() {
    return this.watch.runChecks();
  }
}

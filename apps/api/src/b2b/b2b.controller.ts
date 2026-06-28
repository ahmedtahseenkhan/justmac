import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { createBatchSchema, type CreateBatchRequest } from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { B2bService } from "./b2b.service";

@Controller("b2b")
export class B2bController {
  constructor(private readonly b2b: B2bService) {}

  // Public: a business submits a bulk-quote / ITAD request.
  @Post("batches")
  create(@Body(new ZodValidationPipe(createBatchSchema)) body: CreateBatchRequest) {
    return this.b2b.createBatch(body);
  }

  // Back-office: relationship-manager dashboard.
  @Get("batches")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPS_STAFF")
  list() {
    return this.b2b.listBatches();
  }

  @Get("batches/:reference")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPS_STAFF")
  get(@Param("reference") reference: string) {
    return this.b2b.getBatch(reference);
  }
}

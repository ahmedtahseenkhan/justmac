import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { createAffiliateSchema, type CreateAffiliateRequest } from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AffiliateService } from "./affiliate.service";

@Controller("affiliates")
export class AffiliateController {
  constructor(private readonly affiliates: AffiliateService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  list() {
    return this.affiliates.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  create(@Body(new ZodValidationPipe(createAffiliateSchema)) body: CreateAffiliateRequest) {
    return this.affiliates.create(body);
  }

  @Get(":code")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  get(@Param("code") code: string) {
    return this.affiliates.get(code);
  }

  // Public: referral-link click tracking.
  @Post(":code/click")
  click(@Param("code") code: string) {
    return this.affiliates.click(code).then(() => ({ ok: true }));
  }
}

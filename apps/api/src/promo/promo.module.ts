import { Module } from "@nestjs/common";
import { PromoController, PromoAdminController } from "./promo.controller";
import { PromoService } from "./promo.service";

@Module({
  controllers: [PromoController, PromoAdminController],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}

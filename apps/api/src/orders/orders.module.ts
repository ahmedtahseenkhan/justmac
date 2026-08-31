import { Module } from "@nestjs/common";
import { PromoModule } from "../promo/promo.module";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { ShippingModule } from "../shipping/shipping.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PromoModule, AffiliateModule, ShippingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

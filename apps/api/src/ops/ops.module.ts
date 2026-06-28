import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { ScreeningModule } from "../screening/screening.module";
import { PricingModule } from "../pricing/pricing.module";
import { OpsController } from "./ops.controller";
import { OpsService } from "./ops.service";

@Module({
  imports: [OrdersModule, ScreeningModule, PricingModule],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}

import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { PriceWatchController } from "./price-watch.controller";
import { PriceWatchService } from "./price-watch.service";

@Module({
  imports: [PricingModule],
  controllers: [PriceWatchController],
  providers: [PriceWatchService],
})
export class PriceWatchModule {}

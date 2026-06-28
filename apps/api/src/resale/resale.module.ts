import { Module } from "@nestjs/common";
import { PromoModule } from "../promo/promo.module";
import { ResaleController } from "./resale.controller";
import { ResaleService } from "./resale.service";

@Module({
  imports: [PromoModule],
  controllers: [ResaleController],
  providers: [ResaleService],
})
export class ResaleModule {}

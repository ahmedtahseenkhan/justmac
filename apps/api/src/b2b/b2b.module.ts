import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { B2bController } from "./b2b.controller";
import { B2bService } from "./b2b.service";

@Module({
  imports: [PricingModule],
  controllers: [B2bController],
  providers: [B2bService],
})
export class B2bModule {}

import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { QuoteController } from "./quote.controller";
import { QuoteService } from "./quote.service";

@Module({
  imports: [PricingModule],
  controllers: [QuoteController],
  providers: [QuoteService],
})
export class QuoteModule {}

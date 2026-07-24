import { Module } from "@nestjs/common";
import { MarketPriceController } from "./market-price.controller";
import { MarketPriceService } from "./market-price.service";
import { ScrapeFetcherService } from "./scrape-fetcher.service";

@Module({
  controllers: [MarketPriceController],
  providers: [MarketPriceService, ScrapeFetcherService],
})
export class MarketPriceModule {}

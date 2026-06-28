import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { CatalogAdminController } from "./catalog-admin.controller";
import { CatalogAdminService } from "./catalog-admin.service";

@Module({
  imports: [PricingModule],
  controllers: [CatalogAdminController],
  providers: [CatalogAdminService],
})
export class CatalogAdminModule {}

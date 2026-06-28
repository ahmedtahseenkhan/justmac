import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [PricingModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

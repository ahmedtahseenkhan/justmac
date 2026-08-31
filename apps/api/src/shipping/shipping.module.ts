import { Module } from "@nestjs/common";
import { ShipStationService } from "./shipstation.service";

@Module({
  providers: [ShipStationService],
  exports: [ShipStationService],
})
export class ShippingModule {}

import { Module } from "@nestjs/common";
import { ScreeningService } from "./screening.service";

@Module({
  providers: [ScreeningService],
  exports: [ScreeningService],
})
export class ScreeningModule {}

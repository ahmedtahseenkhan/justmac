import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CacheModule } from "./cache/cache.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PricingModule } from "./pricing/pricing.module";
import { CatalogModule } from "./catalog/catalog.module";
import { QuoteModule } from "./quote/quote.module";
import { ScreeningModule } from "./screening/screening.module";
import { PromoModule } from "./promo/promo.module";
import { OrdersModule } from "./orders/orders.module";
import { OpsModule } from "./ops/ops.module";
import { ResaleModule } from "./resale/resale.module";
import { AdminModule } from "./admin/admin.module";
import { B2bModule } from "./b2b/b2b.module";
import { AffiliateModule } from "./affiliate/affiliate.module";
import { PriceWatchModule } from "./price-watch/price-watch.module";
import { CatalogAdminModule } from "./catalog-admin/catalog-admin.module";
import { DashboardModule } from "./dashboard/dashboard.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CacheModule,
    NotificationsModule,
    PricingModule,
    CatalogModule,
    QuoteModule,
    ScreeningModule,
    PromoModule,
    AffiliateModule,
    OrdersModule,
    OpsModule,
    ResaleModule,
    AdminModule,
    CatalogAdminModule,
    DashboardModule,
    B2bModule,
    PriceWatchModule,
  ],
})
export class AppModule {}

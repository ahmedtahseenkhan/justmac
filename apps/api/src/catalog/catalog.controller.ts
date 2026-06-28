import { Controller, Get, Param, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  categories() {
    return this.catalog.listCategories();
  }

  @Get("models")
  models(@Query("q") q?: string, @Query("category") category?: string) {
    return this.catalog.listModels(q, category);
  }

  @Get("models/:slug")
  model(@Param("slug") slug: string) {
    return this.catalog.getModel(slug);
  }
}

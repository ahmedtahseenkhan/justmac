import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
  conditionAttributeInputSchema,
  createBrandSchema,
  createCategorySchema,
  createModelSchema,
  updateModelSchema,
  updateVariantSchema,
  variantInputSchema,
  type ConditionAttributeInput,
  type CreateBrandRequest,
  type CreateCategoryRequest,
  type CreateModelRequest,
  type UpdateModelRequest,
  type UpdateVariantRequest,
  type VariantInput,
} from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CatalogAdminService } from "./catalog-admin.service";

@Controller("admin/catalog")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogAdminService) {}

  @Get("categories")
  categories() {
    return this.catalog.categories();
  }

  @Get("models")
  models() {
    return this.catalog.models();
  }

  @Post("categories")
  createCategory(@Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryRequest) {
    return this.catalog.createCategory(body);
  }

  @Post("brands")
  createBrand(@Body(new ZodValidationPipe(createBrandSchema)) body: CreateBrandRequest) {
    return this.catalog.createBrand(body);
  }

  @Post("models")
  createModel(@Body(new ZodValidationPipe(createModelSchema)) body: CreateModelRequest) {
    return this.catalog.createModel(body);
  }

  @Post("models/:id/variants")
  addVariant(@Param("id") id: string, @Body(new ZodValidationPipe(variantInputSchema)) body: VariantInput) {
    return this.catalog.addVariant(id, body);
  }

  @Post("models/:id/conditions")
  addCondition(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(conditionAttributeInputSchema)) body: ConditionAttributeInput,
  ) {
    return this.catalog.addCondition(id, body);
  }

  @Delete("models/:id")
  deleteModel(@Param("id") id: string) {
    return this.catalog.deleteModel(id);
  }

  /* ---- edit existing ---- */

  @Get("models/:id")
  modelDetail(@Param("id") id: string) {
    return this.catalog.modelDetail(id);
  }

  @Put("models/:id")
  updateModel(@Param("id") id: string, @Body(new ZodValidationPipe(updateModelSchema)) body: UpdateModelRequest) {
    return this.catalog.updateModel(id, body);
  }

  @Put("variants/:id")
  updateVariant(@Param("id") id: string, @Body(new ZodValidationPipe(updateVariantSchema)) body: UpdateVariantRequest) {
    return this.catalog.updateVariant(id, body);
  }

  @Delete("variants/:id")
  deleteVariant(@Param("id") id: string) {
    return this.catalog.deleteVariant(id);
  }

  @Put("conditions/:id")
  updateCondition(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(conditionAttributeInputSchema)) body: ConditionAttributeInput,
  ) {
    return this.catalog.updateCondition(id, body);
  }

  @Delete("conditions/:id")
  deleteCondition(@Param("id") id: string) {
    return this.catalog.deleteCondition(id);
  }
}

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Device lifecycle state machine
 * ------------------------------------------------------------------ */

export const LIFECYCLE_STATES = [
  "QUOTE_LOCKED",
  "LABEL_ISSUED",
  "IN_TRANSIT",
  "RECEIVED",
  "INSPECTING",
  "OFFER_CONFIRMED",
  "OFFER_ADJUSTED",
  "ACCEPTED",
  "PAID",
  "REJECTED",
  "RETURNED",
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** Allowed forward transitions for the trade-in lifecycle. */
export const LIFECYCLE_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  QUOTE_LOCKED: ["LABEL_ISSUED"],
  LABEL_ISSUED: ["IN_TRANSIT"],
  IN_TRANSIT: ["RECEIVED"],
  RECEIVED: ["INSPECTING"],
  INSPECTING: ["OFFER_CONFIRMED", "OFFER_ADJUSTED"],
  OFFER_CONFIRMED: ["ACCEPTED"],
  OFFER_ADJUSTED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["PAID"],
  REJECTED: ["RETURNED"],
  PAID: [],
  RETURNED: [],
};

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** User-facing labels for the "Track Your Trade-In" view. */
export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  QUOTE_LOCKED: "Quote locked",
  LABEL_ISSUED: "Label issued",
  IN_TRANSIT: "In transit",
  RECEIVED: "Received",
  INSPECTING: "Inspecting",
  OFFER_CONFIRMED: "Offer confirmed",
  OFFER_ADJUSTED: "Offer adjusted",
  ACCEPTED: "Offer accepted",
  PAID: "Paid",
  REJECTED: "Offer rejected",
  RETURNED: "Device returned",
};

/* ------------------------------------------------------------------ *
 * Condition model
 * ------------------------------------------------------------------ */

/** The kinds of condition questions the wizard asks. */
export const CONDITION_KINDS = [
  "COSMETIC",
  "FUNCTIONAL",
  "BATTERY",
  "ACCESSORIES",
  "CARRIER_LOCK",
] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

/* ------------------------------------------------------------------ *
 * Quote request / response contracts
 * ------------------------------------------------------------------ */

/** A single condition answer: which attribute, which option was picked. */
export const conditionSelectionSchema = z.object({
  attributeKey: z.string(),
  optionKey: z.string(),
});
export type ConditionSelection = z.infer<typeof conditionSelectionSchema>;

export const quoteRequestSchema = z.object({
  variantId: z.string(),
  conditions: z.array(conditionSelectionSchema).default([]),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

/** One line in the transparent price breakdown. */
export const breakdownLineSchema = z.object({
  label: z.string(),
  kind: z.enum(["base", "market", "depreciation", "condition", "margin", "guardrail"]),
  /** Multiplicative factor applied at this step (e.g. 0.85), null for additive/base rows. */
  factor: z.number().nullable(),
  /** Signed dollar delta this line contributed to the running total. */
  amount: z.number(),
  /** Running total after this line is applied. */
  runningTotal: z.number(),
});
export type BreakdownLine = z.infer<typeof breakdownLineSchema>;

export const quoteResponseSchema = z.object({
  quoteId: z.string(),
  variantId: z.string(),
  /** Final cash offer in minor-unit-free dollars, rounded. */
  offer: z.number(),
  currency: z.string(),
  /** Expectation-setting range before inspection. */
  confidenceLow: z.number(),
  confidenceHigh: z.number(),
  breakdown: z.array(breakdownLineSchema),
  lockExpiresAt: z.string(), // ISO timestamp
  conditions: z.array(conditionSelectionSchema),
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

/* ------------------------------------------------------------------ *
 * Catalog contracts (read models returned to the web app)
 * ------------------------------------------------------------------ */

export const variantDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  attributes: z.record(z.string()), // e.g. { storage: "256GB", color: "Black" }
});
export type VariantDto = z.infer<typeof variantDtoSchema>;

export const conditionOptionDtoSchema = z.object({
  key: z.string(),
  label: z.string(),
  helper: z.string().nullable(),
});
export type ConditionOptionDto = z.infer<typeof conditionOptionDtoSchema>;

export const conditionAttributeDtoSchema = z.object({
  key: z.string(),
  kind: z.enum(CONDITION_KINDS),
  label: z.string(),
  helper: z.string().nullable(),
  options: z.array(conditionOptionDtoSchema),
});
export type ConditionAttributeDto = z.infer<typeof conditionAttributeDtoSchema>;

export const modelDetailDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  imageUrl: z.string().nullable(),
  cashUpTo: z.number(),
  variants: z.array(variantDtoSchema),
  conditionAttributes: z.array(conditionAttributeDtoSchema),
});
export type ModelDetailDto = z.infer<typeof modelDetailDtoSchema>;

export const modelCardDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  imageUrl: z.string().nullable(),
  cashUpTo: z.number(),
});
export type ModelCardDto = z.infer<typeof modelCardDtoSchema>;

/* ------------------------------------------------------------------ *
 * Checkout / order contracts
 * ------------------------------------------------------------------ */

export const PAYOUT_METHODS = ["ACH", "PAYPAL", "CHECK", "ZELLE"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const SHIPPING_OPTIONS = ["PREPAID_LABEL", "SHIPPING_KIT", "EXPEDITED"] as const;
export type ShippingOption = (typeof SHIPPING_OPTIONS)[number];

export const createOrderItemSchema = z.object({
  quoteId: z.string(),
});

export const createOrderSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  payoutMethod: z.enum(PAYOUT_METHODS),
  payoutDetail: z.string().min(1), // account/email/etc — masked in MVP
  shippingOption: z.enum(SHIPPING_OPTIONS).default("PREPAID_LABEL"),
  promoCode: z.string().optional(),
  instantPayout: z.boolean().optional(),
  affiliateCode: z.string().optional(),
  items: z.array(createOrderItemSchema).min(1),
});
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

/** Instant payout: percentage fee with a floor, deducted from the payout. */
export const INSTANT_PAYOUT_RATE = 0.015;
export const INSTANT_PAYOUT_MIN_FEE = 2;
export function instantPayoutFee(total: number): number {
  return Math.max(INSTANT_PAYOUT_MIN_FEE, Math.round(total * INSTANT_PAYOUT_RATE));
}

export const orderItemDtoSchema = z.object({
  id: z.string(),
  modelName: z.string(),
  variantLabel: z.string(),
  modelSlug: z.string(),
  offer: z.number(),
  state: z.enum(LIFECYCLE_STATES),
  // Phase 2: physical-unit detail attached once the device is received & inspected.
  // Lazy: deviceDtoSchema is defined further down this module.
  device: z.lazy(() => deviceDtoSchema).nullable().optional(),
});
export type OrderItemDto = z.infer<typeof orderItemDtoSchema> & { device?: DeviceDto | null };

export const notificationDtoSchema = z.object({
  id: z.string(),
  channel: z.enum(["EMAIL", "SMS"]),
  subject: z.string(),
  body: z.string(),
  state: z.enum(LIFECYCLE_STATES),
  createdAt: z.string(),
});
export type NotificationDto = z.infer<typeof notificationDtoSchema>;

export const orderDtoSchema = z.object({
  id: z.string(),
  trackingId: z.string(),
  email: z.string(),
  fullName: z.string(),
  payoutMethod: z.enum(PAYOUT_METHODS),
  shippingOption: z.enum(SHIPPING_OPTIONS),
  labelUrl: z.string().nullable(),
  totalOffer: z.number(),
  // Set when an inspection has proposed an adjusted offer the seller hasn't yet answered.
  proposedTotal: z.number().nullable().optional(),
  promoCode: z.string().nullable().optional(),
  promoBonus: z.number().optional(),
  instantPayout: z.boolean().optional(),
  instantPayoutFee: z.number().optional(),
  affiliateCode: z.string().nullable().optional(),
  currency: z.string(),
  state: z.enum(LIFECYCLE_STATES),
  createdAt: z.string(),
  items: z.array(orderItemDtoSchema),
  notifications: z.array(notificationDtoSchema).optional(),
});
export type OrderDto = z.infer<typeof orderDtoSchema>;

/* ------------------------------------------------------------------ *
 * Phase 2 — screening, inspection & ops contracts
 * ------------------------------------------------------------------ */

export const LOCK_STATUSES = ["CLEAR", "ACTIVATION_LOCK", "MDM_LOCK"] as const;
export const BLACKLIST_STATUSES = ["CLEAR", "BLACKLISTED"] as const;

export const screeningResultSchema = z.object({
  lockStatus: z.enum(LOCK_STATUSES),
  blacklistStatus: z.enum(BLACKLIST_STATUSES),
  /** Declared model didn't match the serial/IMEI lookup. */
  mismatch: z.boolean(),
  /** Same serial already seen on another device (re-submission / abuse). */
  velocity: z.boolean(),
  eligible: z.boolean(),
  flags: z.array(z.string()),
});
export type ScreeningResult = z.infer<typeof screeningResultSchema>;

export const inspectionDtoSchema = z.object({
  inspector: z.string().nullable(),
  findings: z.string().nullable(),
  outcome: z.enum(["CONFIRMED", "ADJUSTED"]).nullable(),
  adjustedOffer: z.number().nullable(),
  createdAt: z.string(),
});
export type InspectionDto = z.infer<typeof inspectionDtoSchema>;

export const deviceDtoSchema = z.object({
  id: z.string(),
  serial: z.string().nullable(),
  imei: z.string().nullable(),
  eligible: z.boolean(),
  screening: screeningResultSchema.nullable(),
  inspection: inspectionDtoSchema.nullable(),
});
export type DeviceDto = z.infer<typeof deviceDtoSchema>;

// Ops back-office: receive a shipment & open it for grading.
export const intakeRequestSchema = z.object({
  serial: z.string().min(1),
  imei: z.string().optional(),
});
export type IntakeRequest = z.infer<typeof intakeRequestSchema>;

// Ops back-office: submit a grading result for one device.
export const inspectRequestSchema = z.object({
  inspector: z.string().min(1),
  gradedConditions: z.array(conditionSelectionSchema),
  findings: z.string().optional(),
});
export type InspectRequest = z.infer<typeof inspectRequestSchema>;

// Seller's Fair-Evaluation response to a confirmed/adjusted offer.
export const respondRequestSchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT"]),
});
export type RespondRequest = z.infer<typeof respondRequestSchema>;

/* ------------------------------------------------------------------ *
 * Phase 3 — promos, resale storefront & margins
 * ------------------------------------------------------------------ */

export const PROMO_KINDS = ["BUYBACK_BONUS", "RESALE_DISCOUNT"] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

export const promoValidationSchema = z.object({
  valid: z.boolean(),
  code: z.string(),
  kind: z.enum(PROMO_KINDS).nullable(),
  description: z.string(),
  /** Dollar amount this promo would add (buyback) or subtract (resale) for the given subtotal. */
  amount: z.number(),
});
export type PromoValidation = z.infer<typeof promoValidationSchema>;

export const GRADES = ["A", "B", "C"] as const;
export type Grade = (typeof GRADES)[number];

// A refurbished unit on the storefront.
export const listingDtoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  title: z.string(),
  modelSlug: z.string(),
  grade: z.enum(GRADES),
  gradeLabel: z.string(),
  warrantyMonths: z.number(),
  price: z.number(),
  currency: z.string(),
  status: z.enum(["REFURBISHED", "LISTED", "SOLD"]),
});
export type ListingDto = z.infer<typeof listingDtoSchema>;

// Ops: a PAID device waiting to be refurbished & listed.
export const refurbItemDtoSchema = z.object({
  deviceId: z.string(),
  orderTrackingId: z.string(),
  modelName: z.string(),
  modelSlug: z.string(),
  variantLabel: z.string(),
  serial: z.string().nullable(),
  acquisitionCost: z.number(),
  /** Engine's suggested resale price given acquisition cost + category margin. */
  suggestedPrice: z.number(),
});
export type RefurbItemDto = z.infer<typeof refurbItemDtoSchema>;

export const listDeviceRequestSchema = z.object({
  grade: z.enum(GRADES),
  warrantyMonths: z.number().int().min(0).default(12),
  price: z.number().positive(),
  channel: z.enum(["STOREFRONT", "WHOLESALE"]).default("STOREFRONT"),
});
export type ListDeviceRequest = z.infer<typeof listDeviceRequestSchema>;

export const RESALE_PAY_METHODS = ["CARD", "PAYPAL"] as const;
export type ResalePayMethod = (typeof RESALE_PAY_METHODS)[number];

export const resaleCheckoutSchema = z.object({
  buyerEmail: z.string().email(),
  buyerName: z.string().min(1),
  payMethod: z.enum(RESALE_PAY_METHODS),
  promoCode: z.string().optional(),
  listingIds: z.array(z.string()).min(1),
});
export type ResaleCheckoutRequest = z.infer<typeof resaleCheckoutSchema>;

export const saleDtoSchema = z.object({
  id: z.string(),
  reference: z.string(),
  buyerEmail: z.string(),
  buyerName: z.string(),
  payMethod: z.enum(RESALE_PAY_METHODS),
  promoCode: z.string().nullable(),
  discount: z.number(),
  total: z.number(),
  currency: z.string(),
  createdAt: z.string(),
  items: z.array(
    z.object({ listingId: z.string(), sku: z.string(), title: z.string(), price: z.number() }),
  ),
});
export type SaleDto = z.infer<typeof saleDtoSchema>;

// Margin reporting: what we paid to acquire vs. what we sold for.
export const marginReportSchema = z.object({
  unitsSold: z.number(),
  revenue: z.number(),
  acquisitionCost: z.number(),
  grossMargin: z.number(),
  marginPct: z.number(),
  listedCount: z.number(),
  currency: z.string(),
  recent: z.array(
    z.object({
      sku: z.string(),
      title: z.string(),
      acquisitionCost: z.number(),
      price: z.number(),
      margin: z.number(),
      soldAt: z.string(),
    }),
  ),
});
export type MarginReport = z.infer<typeof marginReportSchema>;

/* ------------------------------------------------------------------ *
 * Admin — pricing console (the core IP: the live pricing matrix)
 * ------------------------------------------------------------------ */

export const adminVariantDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  attributes: z.record(z.string()),
  baseValue: z.number(),
  floor: z.number(),
  ceiling: z.number(),
  effectiveAt: z.string(),
});
export type AdminVariantDto = z.infer<typeof adminVariantDtoSchema>;

export const adminModelDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  categorySlug: z.string(),
  categoryName: z.string(),
  targetMargin: z.number(),
  marketFactor: z.number(),
  feedUpdatedAt: z.string().nullable(),
  variants: z.array(adminVariantDtoSchema),
});
export type AdminModelDto = z.infer<typeof adminModelDtoSchema>;

export const adminCategoryDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  targetMargin: z.number(),
  modelCount: z.number(),
});
export type AdminCategoryDto = z.infer<typeof adminCategoryDtoSchema>;

export const updateMarginSchema = z.object({ targetMargin: z.number().min(0).max(0.9) });
export type UpdateMarginRequest = z.infer<typeof updateMarginSchema>;

export const updateFeedSchema = z.object({ factor: z.number().min(0.1).max(3) });
export type UpdateFeedRequest = z.infer<typeof updateFeedSchema>;

export const updateVariantPriceSchema = z
  .object({
    baseValue: z.number().positive(),
    floor: z.number().min(0),
    ceiling: z.number().positive(),
  })
  .refine((v) => v.floor <= v.ceiling, { message: "floor must be ≤ ceiling" });
export type UpdateVariantPriceRequest = z.infer<typeof updateVariantPriceSchema>;

// Bulk price upload: each row keyed by model slug + variant label.
export const bulkPriceRowSchema = z.object({
  modelSlug: z.string(),
  variantLabel: z.string(),
  baseValue: z.number(),
  floor: z.number(),
  ceiling: z.number(),
});
export type BulkPriceRow = z.infer<typeof bulkPriceRowSchema>;

export const bulkPriceRequestSchema = z.object({ rows: z.array(bulkPriceRowSchema).min(1) });
export type BulkPriceRequest = z.infer<typeof bulkPriceRequestSchema>;

export const bulkPriceResultSchema = z.object({
  updated: z.number(),
  errors: z.array(z.object({ row: z.number(), message: z.string() })),
});
export type BulkPriceResult = z.infer<typeof bulkPriceResultSchema>;

// "What would this config quote right now" — no persisted quote.
export const simulateResponseSchema = z.object({
  offer: z.number(),
  currency: z.string(),
  confidenceLow: z.number(),
  confidenceHigh: z.number(),
  breakdown: z.array(breakdownLineSchema),
});
export type SimulateResponse = z.infer<typeof simulateResponseSchema>;

/* ------------------------------------------------------------------ *
 * Phase 4 — B2B / Bulk / ITAD
 * ------------------------------------------------------------------ */

export const BATCH_TYPES = ["BUYBACK", "ITAD"] as const;
export type BatchType = (typeof BATCH_TYPES)[number];

export const BATCH_STATUSES = ["SUBMITTED", "PROCESSING", "COMPLETED"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

// One row of a bulk submission (CSV: modelSlug,variantLabel,serial).
export const bulkDeviceInputSchema = z.object({
  modelSlug: z.string().min(1),
  variantLabel: z.string().min(1),
  serial: z.string().optional(),
});
export type BulkDeviceInput = z.infer<typeof bulkDeviceInputSchema>;

export const createBatchSchema = z.object({
  company: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  netTermsDays: z.number().int().min(0).max(120).optional(),
  type: z.enum(BATCH_TYPES),
  devices: z.array(bulkDeviceInputSchema).min(1).max(1000),
});
export type CreateBatchRequest = z.infer<typeof createBatchSchema>;

export const custodyEventSchema = z.object({ event: z.string(), at: z.string() });
export type CustodyEvent = z.infer<typeof custodyEventSchema>;

export const bulkDeviceDtoSchema = z.object({
  id: z.string(),
  modelName: z.string(),
  variantLabel: z.string(),
  serial: z.string().nullable(),
  quotedValue: z.number(),
  matched: z.boolean(),
  wipeCertUrl: z.string().nullable(),
  destructionCertUrl: z.string().nullable(),
  custody: z.array(custodyEventSchema),
});
export type BulkDeviceDto = z.infer<typeof bulkDeviceDtoSchema>;

export const invoiceDtoSchema = z.object({
  number: z.string(),
  amount: z.number(),
  netTermsDays: z.number(),
  dueDate: z.string(),
  status: z.enum(["ISSUED", "PAID"]),
});
export type InvoiceDto = z.infer<typeof invoiceDtoSchema>;

export const batchDtoSchema = z.object({
  id: z.string(),
  reference: z.string(),
  company: z.string(),
  contactName: z.string(),
  type: z.enum(BATCH_TYPES),
  status: z.enum(BATCH_STATUSES),
  manager: z.string(),
  deviceCount: z.number(),
  totalValue: z.number(),
  currency: z.string(),
  createdAt: z.string(),
  invoice: invoiceDtoSchema.nullable(),
  devices: z.array(bulkDeviceDtoSchema),
});
export type BatchDto = z.infer<typeof batchDtoSchema>;

// Summary row for the relationship-manager dashboard.
export const batchSummaryDtoSchema = z.object({
  id: z.string(),
  reference: z.string(),
  company: z.string(),
  type: z.enum(BATCH_TYPES),
  status: z.enum(BATCH_STATUSES),
  manager: z.string(),
  deviceCount: z.number(),
  totalValue: z.number(),
  matchedCount: z.number(),
  createdAt: z.string(),
});
export type BatchSummaryDto = z.infer<typeof batchSummaryDtoSchema>;

/* ------------------------------------------------------------------ *
 * Phase 4 — affiliate program
 * ------------------------------------------------------------------ */

export const affiliateConversionDtoSchema = z.object({
  orderTrackingId: z.string(),
  payoutBase: z.number(),
  commission: z.number(),
  createdAt: z.string(),
});
export type AffiliateConversionDto = z.infer<typeof affiliateConversionDtoSchema>;

export const affiliateDtoSchema = z.object({
  code: z.string(),
  name: z.string(),
  email: z.string(),
  ratePct: z.number(),
  clicks: z.number(),
  earnings: z.number(),
  conversionCount: z.number(),
  currency: z.string(),
  conversions: z.array(affiliateConversionDtoSchema).optional(),
});
export type AffiliateDto = z.infer<typeof affiliateDtoSchema>;

export const createAffiliateSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(1),
  email: z.string().email(),
  ratePct: z.number().min(0).max(50).default(5),
});
export type CreateAffiliateRequest = z.infer<typeof createAffiliateSchema>;

/* ------------------------------------------------------------------ *
 * Phase 4 — price-watch alerts
 * ------------------------------------------------------------------ */

export const createPriceWatchSchema = z.object({
  email: z.string().email(),
  variantId: z.string().min(1),
  threshold: z.number().positive(),
});
export type CreatePriceWatchRequest = z.infer<typeof createPriceWatchSchema>;

export const priceWatchDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  modelName: z.string(),
  variantLabel: z.string(),
  threshold: z.number(),
  lastOffer: z.number(),
  active: z.boolean(),
  triggeredAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PriceWatchDto = z.infer<typeof priceWatchDtoSchema>;

export const priceWatchRunResultSchema = z.object({
  checked: z.number(),
  triggered: z.array(priceWatchDtoSchema),
});
export type PriceWatchRunResult = z.infer<typeof priceWatchRunResultSchema>;

/* ------------------------------------------------------------------ *
 * Back office — auth, users, catalog management, promos, dashboard
 * ------------------------------------------------------------------ */

export const ROLES = ["ADMIN", "OPS_STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  active: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.object({ token: z.string(), user: authUserSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(ROLES).default("OPS_STAFF"),
});
export type CreateUserRequest = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

/* ---- Catalog management ---- */

export const variantInputSchema = z.object({
  label: z.string().min(1),
  attributes: z.record(z.string()).default({}),
  baseValue: z.number().positive(),
  floor: z.number().min(0),
  ceiling: z.number().positive(),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const conditionOptionInputSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  helper: z.string().nullable().optional(),
  multiplier: z.number().min(0).max(2),
});
export const conditionAttributeInputSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(CONDITION_KINDS),
  label: z.string().min(1),
  helper: z.string().nullable().optional(),
  options: z.array(conditionOptionInputSchema).min(1),
});
export type ConditionAttributeInput = z.infer<typeof conditionAttributeInputSchema>;

export const createCategorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  targetMargin: z.number().min(0).max(0.9).default(0.25),
});
export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;

export const createBrandSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().min(1),
});
export type CreateBrandRequest = z.infer<typeof createBrandSchema>;

export const createModelSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  variants: z.array(variantInputSchema).min(1),
  conditionAttributes: z.array(conditionAttributeInputSchema).min(1),
});
export type CreateModelRequest = z.infer<typeof createModelSchema>;

export const catalogBrandDtoSchema = z.object({ id: z.string(), slug: z.string(), name: z.string(), categoryId: z.string() });
export const catalogCategoryDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  targetMargin: z.number(),
  brands: z.array(catalogBrandDtoSchema),
});
export type CatalogCategoryDto = z.infer<typeof catalogCategoryDtoSchema>;

export const catalogModelRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  variantCount: z.number(),
  cashUpTo: z.number(),
});
export type CatalogModelRow = z.infer<typeof catalogModelRowSchema>;

// Full model detail for the catalog editor (includes ids + current prices).
export const adminVariantDetailSchema = z.object({
  id: z.string(),
  label: z.string(),
  attributes: z.record(z.string()),
  baseValue: z.number(),
  floor: z.number(),
  ceiling: z.number(),
});
export const adminConditionDetailSchema = z.object({
  id: z.string(),
  key: z.string(),
  kind: z.enum(CONDITION_KINDS),
  label: z.string(),
  helper: z.string().nullable(),
  options: z.array(z.object({ key: z.string(), label: z.string(), helper: z.string().nullable(), multiplier: z.number() })),
});
export const adminModelDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  categoryId: z.string(),
  brandId: z.string(),
  category: z.string(),
  brand: z.string(),
  variants: z.array(adminVariantDetailSchema),
  conditionAttributes: z.array(adminConditionDetailSchema),
});
export type AdminModelDetail = z.infer<typeof adminModelDetailSchema>;

export const updateModelSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
});
export type UpdateModelRequest = z.infer<typeof updateModelSchema>;

// Edit one variant: label + attributes + (versioned) price.
export const updateVariantSchema = z
  .object({
    label: z.string().min(1),
    attributes: z.record(z.string()).default({}),
    baseValue: z.number().positive(),
    floor: z.number().min(0),
    ceiling: z.number().positive(),
  })
  .refine((v) => v.floor <= v.ceiling, { message: "floor must be ≤ ceiling" });
export type UpdateVariantRequest = z.infer<typeof updateVariantSchema>;

/* ---- Promo management ---- */

export const upsertPromoSchema = z.object({
  code: z.string().min(2).max(24),
  kind: z.enum(PROMO_KINDS),
  valueType: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive(),
  scope: z.string().default("ALL"),
  active: z.boolean().default(true),
});
export type UpsertPromoRequest = z.infer<typeof upsertPromoSchema>;

export const promoDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  kind: z.enum(PROMO_KINDS),
  valueType: z.enum(["PERCENT", "FIXED"]),
  value: z.number(),
  scope: z.string(),
  active: z.boolean(),
});
export type PromoDto = z.infer<typeof promoDtoSchema>;

/* ---- Orders admin + dashboard ---- */

export const orderSummaryDtoSchema = z.object({
  trackingId: z.string(),
  fullName: z.string(),
  email: z.string(),
  state: z.enum(LIFECYCLE_STATES),
  totalOffer: z.number(),
  itemCount: z.number(),
  createdAt: z.string(),
});
export type OrderSummaryDto = z.infer<typeof orderSummaryDtoSchema>;

export const orderListDtoSchema = z.object({
  orders: z.array(orderSummaryDtoSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type OrderListDto = z.infer<typeof orderListDtoSchema>;

export const dashboardDtoSchema = z.object({
  ordersByState: z.record(z.number()),
  awaitingAction: z.number(),
  paidCount: z.number(),
  paidTotal: z.number(),
  listingsLive: z.number(),
  unitsSold: z.number(),
  grossMargin: z.number(),
  marginPct: z.number(),
  affiliateEarnings: z.number(),
  b2bBatches: z.number(),
  modelCount: z.number(),
  currency: z.string(),
});
export type DashboardDto = z.infer<typeof dashboardDtoSchema>;

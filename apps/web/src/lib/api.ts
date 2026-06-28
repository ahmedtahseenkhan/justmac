import type {
  ModelCardDto,
  ModelDetailDto,
  OrderDto,
  QuoteRequest,
  QuoteResponse,
  CreateOrderRequest,
  LifecycleState,
  IntakeRequest,
  InspectRequest,
  RespondRequest,
  ListingDto,
  RefurbItemDto,
  ListDeviceRequest,
  ResaleCheckoutRequest,
  SaleDto,
  MarginReport,
  PromoValidation,
  PromoKind,
  AdminCategoryDto,
  AdminModelDto,
  UpdateVariantPriceRequest,
  BulkPriceRow,
  BulkPriceResult,
  SimulateResponse,
  ConditionSelection,
  CreateBatchRequest,
  BatchDto,
  BatchSummaryDto,
  AffiliateDto,
  CreateAffiliateRequest,
  PriceWatchDto,
  PriceWatchRunResult,
  LoginRequest,
  LoginResponse,
  AuthUser,
  CatalogCategoryDto,
  CatalogModelRow,
  CreateCategoryRequest,
  CreateBrandRequest,
  CreateModelRequest,
  VariantInput,
  ConditionAttributeInput,
  AdminModelDetail,
  UpdateModelRequest,
  UpdateVariantRequest,
  PromoDto,
  UpsertPromoRequest,
  OrderListDto,
  DashboardDto,
  CreateUserRequest,
  UpdateUserRequest,
} from "@sellme/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Read the back-office JWT from the cookie (client only; null during SSR of public pages). */
function readToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )jm_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readToken();
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`API ${res.status} on ${path} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export type CategoryStat = { slug: string; name: string; modelCount: number };

export const api = {
  listCategories: () => http<CategoryStat[]>(`/catalog/categories`),
  listModels: (q?: string, category?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const qs = params.toString();
    return http<ModelCardDto[]>(`/catalog/models${qs ? `?${qs}` : ""}`);
  },
  getModel: (slug: string) => http<ModelDetailDto>(`/catalog/models/${slug}`),
  createQuote: (body: QuoteRequest) =>
    http<QuoteResponse>(`/quote`, { method: "POST", body: JSON.stringify(body) }),
  createOrder: (body: CreateOrderRequest) =>
    http<OrderDto>(`/orders`, { method: "POST", body: JSON.stringify(body) }),
  trackOrder: (trackingId: string) => http<OrderDto>(`/orders/${trackingId}`),
  advanceOrder: (trackingId: string, to: LifecycleState, note?: string) =>
    http<OrderDto>(`/orders/${trackingId}/advance`, {
      method: "POST",
      body: JSON.stringify({ to, note }),
    }),
  respondOrder: (trackingId: string, body: RespondRequest) =>
    http<OrderDto>(`/orders/${trackingId}/respond`, { method: "POST", body: JSON.stringify(body) }),

  // Ops back-office
  opsQueue: () => http<OrderDto[]>(`/ops/queue`),
  opsIntake: (trackingId: string, body: IntakeRequest) =>
    http<OrderDto>(`/ops/orders/${trackingId}/intake`, { method: "POST", body: JSON.stringify(body) }),
  opsInspect: (orderItemId: string, body: InspectRequest) =>
    http<OrderDto>(`/ops/items/${orderItemId}/inspect`, { method: "POST", body: JSON.stringify(body) }),

  // Promo
  validatePromo: (code: string, kind: PromoKind, subtotal: number, categories: string[]) => {
    const p = new URLSearchParams({ code, kind, subtotal: String(subtotal), categories: categories.join(",") });
    return http<PromoValidation>(`/promo/validate?${p.toString()}`);
  },

  // Resale storefront
  shop: (category?: string) =>
    http<ListingDto[]>(`/shop${category ? `?category=${category}` : ""}`),
  getListing: (sku: string) => http<ListingDto>(`/shop/${sku}`),
  resaleCheckout: (body: ResaleCheckoutRequest) =>
    http<SaleDto>(`/resale/checkout`, { method: "POST", body: JSON.stringify(body) }),

  // Resale ops
  refurbQueue: () => http<RefurbItemDto[]>(`/resale/refurb-queue`),
  listDevice: (deviceId: string, body: ListDeviceRequest) =>
    http<ListingDto>(`/resale/devices/${deviceId}/list`, { method: "POST", body: JSON.stringify(body) }),
  margins: () => http<MarginReport>(`/resale/margins`),

  // Admin pricing console
  adminCategories: () => http<AdminCategoryDto[]>(`/admin/pricing/categories`),
  adminModels: (category?: string) =>
    http<AdminModelDto[]>(`/admin/pricing/models${category ? `?category=${category}` : ""}`),
  adminUpdateMargin: (categoryId: string, targetMargin: number) =>
    http<AdminCategoryDto[]>(`/admin/pricing/categories/${categoryId}/margin`, {
      method: "PUT",
      body: JSON.stringify({ targetMargin }),
    }),
  adminUpdateFeed: (modelId: string, factor: number) =>
    http<AdminModelDto[]>(`/admin/pricing/models/${modelId}/feed`, {
      method: "PUT",
      body: JSON.stringify({ factor }),
    }),
  adminUpdateVariantPrice: (variantId: string, body: UpdateVariantPriceRequest) =>
    http<{ ok: boolean }>(`/admin/pricing/variants/${variantId}/price`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  adminBulk: (rows: BulkPriceRow[]) =>
    http<BulkPriceResult>(`/admin/pricing/bulk`, { method: "POST", body: JSON.stringify({ rows }) }),
  adminSimulate: (variantId: string, conditions: ConditionSelection[]) =>
    http<SimulateResponse>(`/admin/pricing/simulate`, {
      method: "POST",
      body: JSON.stringify({ variantId, conditions }),
    }),

  // B2B / Bulk / ITAD
  createBatch: (body: CreateBatchRequest) =>
    http<BatchDto>(`/b2b/batches`, { method: "POST", body: JSON.stringify(body) }),
  listBatches: () => http<BatchSummaryDto[]>(`/b2b/batches`),
  getBatch: (reference: string) => http<BatchDto>(`/b2b/batches/${reference}`),

  // Affiliates
  listAffiliates: () => http<AffiliateDto[]>(`/affiliates`),
  getAffiliate: (code: string) => http<AffiliateDto>(`/affiliates/${code}`),
  createAffiliate: (body: CreateAffiliateRequest) =>
    http<AffiliateDto>(`/affiliates`, { method: "POST", body: JSON.stringify(body) }),
  affiliateClick: (code: string) =>
    http<{ ok: boolean }>(`/affiliates/${code}/click`, { method: "POST" }),

  // Price-watch
  createPriceWatch: (email: string, variantId: string, threshold: number) =>
    http<PriceWatchDto>(`/price-watch`, {
      method: "POST",
      body: JSON.stringify({ email, variantId, threshold }),
    }),
  listPriceWatches: (email?: string) =>
    http<PriceWatchDto[]>(`/price-watch${email ? `?email=${encodeURIComponent(email)}` : ""}`),
  runPriceWatch: () => http<PriceWatchRunResult>(`/price-watch/run`, { method: "POST" }),

  // ---- Back office: auth ----
  login: (body: LoginRequest) =>
    http<LoginResponse>(`/auth/login`, { method: "POST", body: JSON.stringify(body) }),
  me: () => http<AuthUser>(`/auth/me`),

  // ---- Back office: dashboard + orders ----
  dashboard: () => http<DashboardDto>(`/admin/dashboard`),
  listOrders: (params: { state?: string; q?: string; page?: number } = {}) => {
    const p = new URLSearchParams();
    if (params.state) p.set("state", params.state);
    if (params.q) p.set("q", params.q);
    if (params.page) p.set("page", String(params.page));
    const qs = p.toString();
    return http<OrderListDto>(`/orders${qs ? `?${qs}` : ""}`);
  },

  // ---- Back office: catalog manager ----
  catalogAdminCategories: () => http<CatalogCategoryDto[]>(`/admin/catalog/categories`),
  catalogAdminModels: () => http<CatalogModelRow[]>(`/admin/catalog/models`),
  createCategory: (body: CreateCategoryRequest) =>
    http<unknown>(`/admin/catalog/categories`, { method: "POST", body: JSON.stringify(body) }),
  createBrand: (body: CreateBrandRequest) =>
    http<unknown>(`/admin/catalog/brands`, { method: "POST", body: JSON.stringify(body) }),
  createModel: (body: CreateModelRequest) =>
    http<{ id: string; slug: string }>(`/admin/catalog/models`, { method: "POST", body: JSON.stringify(body) }),
  addVariant: (modelId: string, body: VariantInput) =>
    http<unknown>(`/admin/catalog/models/${modelId}/variants`, { method: "POST", body: JSON.stringify(body) }),
  addCondition: (modelId: string, body: ConditionAttributeInput) =>
    http<unknown>(`/admin/catalog/models/${modelId}/conditions`, { method: "POST", body: JSON.stringify(body) }),
  deleteModel: (id: string) => http<{ ok: true }>(`/admin/catalog/models/${id}`, { method: "DELETE" }),
  // edit existing
  catalogModelDetail: (id: string) => http<AdminModelDetail>(`/admin/catalog/models/${id}`),
  updateModel: (id: string, body: UpdateModelRequest) =>
    http<{ ok: true }>(`/admin/catalog/models/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  updateVariant: (id: string, body: UpdateVariantRequest) =>
    http<{ ok: true }>(`/admin/catalog/variants/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteVariant: (id: string) => http<{ ok: true }>(`/admin/catalog/variants/${id}`, { method: "DELETE" }),
  updateCondition: (id: string, body: ConditionAttributeInput) =>
    http<{ ok: true }>(`/admin/catalog/conditions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCondition: (id: string) => http<{ ok: true }>(`/admin/catalog/conditions/${id}`, { method: "DELETE" }),

  // ---- Back office: promos ----
  listPromos: () => http<PromoDto[]>(`/admin/promos`),
  upsertPromo: (body: UpsertPromoRequest) =>
    http<PromoDto>(`/admin/promos`, { method: "POST", body: JSON.stringify(body) }),
  deletePromo: (id: string) => http<{ ok: true }>(`/admin/promos/${id}`, { method: "DELETE" }),

  // ---- Back office: users ----
  listUsers: () => http<AuthUser[]>(`/auth/users`),
  createUser: (body: CreateUserRequest) =>
    http<AuthUser>(`/auth/users`, { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: UpdateUserRequest) =>
    http<AuthUser>(`/auth/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteUser: (id: string) => http<{ ok: true }>(`/auth/users/${id}`, { method: "DELETE" }),
};

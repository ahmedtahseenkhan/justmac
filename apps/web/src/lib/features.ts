/**
 * Feature flags. For the sell-flow demo, the resale storefront ("Certified Pre-Owned")
 * and the Business/ITAD module are hidden behind "Coming soon". Flip these back to `true`
 * to re-enable them everywhere (nav, pages, admin sidebar, dashboard KPIs).
 */
export const FEATURES = {
  shop: false, // Certified Pre-Owned storefront + resale ops
  business: false, // B2B / Bulk / ITAD
} as const;

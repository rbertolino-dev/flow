export type LandingPageAccess = "loading" | "allow" | "deny";

export function slugifyLandingPage(value: string): string {
  const base = (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "landing-page";
}

export function resolveLandingPageAccess(input: {
  featuresLoading: boolean;
  permsLoading: boolean;
  roleLoading: boolean;
  isPlatformAdmin: boolean;
  hasFeature: boolean;
  isOrgAdmin: boolean;
  hasSavedPermissions: boolean;
  canView: boolean;
}): LandingPageAccess {
  if (input.featuresLoading || input.permsLoading || input.roleLoading) return "loading";
  if (input.isPlatformAdmin) return "allow";
  if (!input.hasFeature) return "deny";
  if (input.isOrgAdmin || !input.hasSavedPermissions) return "allow";
  return input.canView ? "allow" : "deny";
}

const PUBLIC_PRODUCT_KEYS = new Set([
  "id",
  "name",
  "description",
  "price",
  "image_url",
  "category",
  "unit",
  "is_active",
  "in_stock",
]);

const FORBIDDEN_PUBLIC_KEYS = [
  "cost",
  "wholesale_price",
  "sku",
  "barcode",
  "stock_quantity",
  "commission_percentage",
  "commission_fixed",
  "form_notification_email",
  "whatsapp_instance_id",
  "created_by",
  "updated_by",
  "min_stock",
  "ideal_stock",
  "is_supply",
];

export function publicLandingPayloadIssues(payload: Record<string, unknown>): string[] {
  const issues: string[] = [];
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (key in payload) issues.push(`página expõe ${key}`);
  }
  const items = Array.isArray(payload.items) ? payload.items : [];
  items.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      issues.push(`item ${index} inválido`);
      return;
    }
    const row = item as Record<string, unknown>;
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      if (key in row) issues.push(`item ${index} expõe ${key}`);
    }
    const product = row.product;
    if (!product || typeof product !== "object") {
      issues.push(`item ${index} sem produto`);
      return;
    }
    const productRow = product as Record<string, unknown>;
    for (const key of Object.keys(productRow)) {
      if (!PUBLIC_PRODUCT_KEYS.has(key)) issues.push(`produto ${index} expõe ${key}`);
    }
    if (typeof productRow.in_stock !== "boolean") issues.push(`produto ${index} sem disponibilidade`);
    if (typeof productRow.price !== "number") issues.push(`produto ${index} com preço inválido`);
  });
  return issues;
}

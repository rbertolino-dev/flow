export type PosItemType = "product" | "service";

export interface PosCartItem {
  key: string;
  item_type: PosItemType;
  item_id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  category?: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  stock_quantity?: number | null;
}

export interface PosPaymentLine {
  id: string;
  method: string;
  amount: number;
  tendered_amount?: number | null;
  change_amount?: number;
}

export interface PosSalePayment {
  id: string;
  sale_id: string;
  method: string;
  amount: number;
  tendered_amount?: number | null;
  change_amount?: number;
  created_at?: string;
}

export interface PosFinanceEntryRef {
  id: string;
  amount: number;
  due_date: string;
  method: string;
  status: "open" | "paid";
}

export interface PosSaleReturnItem {
  id: string;
  line_type: "returned" | "replacement";
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_type: PosItemType;
}

export interface PosSaleReturn {
  id: string;
  kind: "return" | "exchange";
  returned_amount: number;
  replacement_amount: number;
  difference_amount: number;
  settlement_method?: string | null;
  created_at: string;
  items?: PosSaleReturnItem[];
}

export interface PosSaleItem {
  id: string;
  sale_id: string;
  item_type: PosItemType;
  item_id?: string | null;
  name: string;
  sku?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
}

export interface PosSale {
  id: string;
  organization_id: string;
  sale_number: number;
  cash_session_id?: string | null;
  lead_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  notes?: string | null;
  add_commission: boolean;
  commission_amount: number;
  sold_by?: string | null;
  sold_by_name?: string | null;
  sold_at?: string | null;
  supplier_name?: string | null;
  created_at: string;
  items?: PosSaleItem[];
  payments?: PosSalePayment[];
  returns?: PosSaleReturn[];
  /** Valor pago na forma filtrada. Presente só quando o histórico filtra por forma de pagamento. */
  payment_amount?: number;
}

export interface PosSalesSummary {
  sales_count: number;
  sales_total: number;
}

export interface ListSalesOptions {
  search?: string;
  sale_code?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  include_items?: boolean;
  /** Contato (nome) ou telefone do cliente */
  customer_field?: "contato" | "telefone";
  customer_query?: string;
  /** UUID do usuário responsável (sold_by) */
  sold_by?: string;
  /** Método em pos_sale_payments */
  payment_method?: string;
  /** Origem da venda (pdv, orcamento, importacao) */
  origin?: string;
  price_min?: number;
  price_max?: number;
  /** Apenas vendas com nota fiscal emitida */
  with_invoice?: boolean;
}

export interface ListSalesResult {
  data: PosSale[];
  summary: PosSalesSummary;
}

export interface PosCashCategoryTotal {
  category: string;
  quantity: number;
  amount: number;
}

export interface PosCashOtherEntry {
  description: string;
  amount: number;
}

export interface PosCashConsolidated {
  payments: Array<{ method: string; amount: number }>;
  products_by_category: PosCashCategoryTotal[];
  services_by_category: PosCashCategoryTotal[];
  other_entries: PosCashOtherEntry[];
}

export type PosCommissionType = "percent" | "fixed";
export type PosStockCodeField = "sku" | "barcode";

export interface PosPaymentDiscount {
  method: string;
  percent: number;
}

export interface PosPaymentSurcharge {
  id: string;
  method: string;
  percent: number;
  installments_from: number | null;
  installments_to: number | null;
}

export interface PosPromotion {
  id: string;
  name: string;
  valid_until: string | null;
  percent: number;
  categories: string[];
}

export interface PosSettings {
  sale_notes: string;
  financial_account: string;
  financial_category: string;
  default_lead_id: string | null;
  default_lead_name: string | null;
  simple_sale: boolean;
  commission_required: boolean;
  show_payment_method: boolean;
  commission_type: PosCommissionType;
  commission_value: number;
  stock_code_field: PosStockCodeField;
  block_out_of_stock: boolean;
  payment_discounts: PosPaymentDiscount[];
  payment_surcharges: PosPaymentSurcharge[];
  promotions: PosPromotion[];
}

export const DEFAULT_POS_SETTINGS: PosSettings = {
  sale_notes: "",
  financial_account: "",
  financial_category: "",
  default_lead_id: null,
  default_lead_name: null,
  simple_sale: false,
  commission_required: false,
  show_payment_method: true,
  commission_type: "percent",
  commission_value: 0,
  stock_code_field: "sku",
  block_out_of_stock: false,
  payment_discounts: [],
  payment_surcharges: [],
  promotions: [],
};

export function normalizePaymentDiscounts(raw: unknown): PosPaymentDiscount[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const discounts: PosPaymentDiscount[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const method = String((item as { method?: string }).method || "").trim();
    const percent = Number((item as { percent?: number }).percent || 0);
    if (!method || percent <= 0 || percent > 100 || seen.has(method)) continue;
    seen.add(method);
    discounts.push({ method, percent });
  }
  return discounts;
}

function optionalInstallment(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 48) return null;
  return Math.round(parsed);
}

export function normalizePaymentSurcharges(raw: unknown): PosPaymentSurcharge[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const surcharges: PosPaymentSurcharge[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<PosPaymentSurcharge>;
    const method = String(row.method || "").trim();
    const percent = Number(row.percent || 0);
    if (!method || percent <= 0 || percent > 100) continue;
    const isCard = method === "cartao_credito";
    const installmentsFrom = isCard ? optionalInstallment(row.installments_from) : null;
    const installmentsTo = isCard ? optionalInstallment(row.installments_to) : null;
    if (
      installmentsFrom != null &&
      installmentsTo != null &&
      installmentsFrom > installmentsTo
    ) {
      continue;
    }
    const key = `${method}|${installmentsFrom ?? ""}|${installmentsTo ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    surcharges.push({
      id: String(row.id || key),
      method,
      percent,
      installments_from: installmentsFrom,
      installments_to: installmentsTo,
    });
  }
  return surcharges;
}

export function normalizePromotions(raw: unknown): PosPromotion[] {
  const list = Array.isArray(raw) ? raw : [];
  const promotions: PosPromotion[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<PosPromotion>;
    const name = String(row.name || "").trim();
    const percent = Number(row.percent || 0);
    if (!name || percent <= 0 || percent > 100) continue;
    const validUntil = String(row.valid_until || "").slice(0, 10);
    const categories = Array.isArray(row.categories)
      ? [...new Set(row.categories.map((category) => String(category || "").trim()).filter(Boolean))]
      : [];
    promotions.push({
      id: String(row.id || `${name}-${promotions.length}`),
      name,
      valid_until: /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : null,
      percent,
      categories,
    });
  }
  return promotions;
}

export function normalizePosSettings(raw?: Partial<PosSettings> | null): PosSettings {
  const commissionType = raw?.commission_type === "fixed" ? "fixed" : "percent";
  const stockCode = raw?.stock_code_field === "barcode" ? "barcode" : "sku";
  return {
    ...DEFAULT_POS_SETTINGS,
    ...raw,
    sale_notes: raw?.sale_notes || "",
    financial_account: raw?.financial_account || "",
    financial_category: raw?.financial_category || "",
    default_lead_id: raw?.default_lead_id || null,
    default_lead_name: raw?.default_lead_name || null,
    simple_sale: Boolean(raw?.simple_sale),
    commission_required: Boolean(raw?.commission_required),
    show_payment_method: raw?.show_payment_method !== false,
    commission_type: commissionType,
    commission_value: Number(raw?.commission_value || 0),
    stock_code_field: stockCode,
    block_out_of_stock: Boolean(raw?.block_out_of_stock),
    payment_discounts: normalizePaymentDiscounts(raw?.payment_discounts),
    payment_surcharges: normalizePaymentSurcharges(raw?.payment_surcharges),
    promotions: normalizePromotions(raw?.promotions),
  };
}

export interface PosCashSession {
  id: string;
  organization_id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at?: string | null;
  opening_amount: number;
  closing_amount?: number | null;
  opened_by_name?: string | null;
}

export interface FinalizeSalePayload {
  items: Array<{
    item_type: PosItemType;
    item_id?: string | null;
    name: string;
    sku?: string | null;
    unit?: string | null;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }>;
  payments: Array<{
    method: string;
    amount: number;
    tendered_amount?: number | null;
    change_amount?: number;
  }>;
  finance_lines?: Array<{ amount: number; due_date: string; method: string }>;
  attachment_name?: string | null;
  split_mode?: "parcelar" | "recorrencia" | "entrada" | null;
  discount_amount?: number;
  surcharge_amount?: number;
  promotion_name?: string | null;
  notes?: string | null;
  add_commission?: boolean;
  commission_user_id?: string | null;
  commission_user_name?: string | null;
  lead_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  cash_session_id?: string | null;
  apply_stock?: boolean;
  generate_financial?: boolean;
  payment_date?: string | null;
  payment_notes?: string | null;
  sale_description?: string | null;
  financial_account?: string | null;
  financial_category?: string | null;
  sold_at?: string | null;
  default_commission_type?: "percent" | "fixed";
  default_commission_value?: number;
}

export interface FinalizeSaleResult {
  id: string;
  sale_number: number;
  total: number;
  subtotal: number;
  discount_amount: number;
  commission_amount: number;
  cash_session_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sold_at?: string | null;
  sold_by_name?: string | null;
  notes?: string | null;
  sale_description?: string | null;
  apply_stock?: boolean;
  generate_financial?: boolean;
  financial_entries?: PosFinanceEntryRef[];
}

export interface UpdateSalePayload {
  sale_id: string;
  notes?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sold_at?: string | null;
  supplier_name?: string | null;
}

export interface UpdateSaleItemsPayload {
  sale_id: string;
  items: Array<{ id: string; quantity: number }>;
}

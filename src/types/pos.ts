export type PosItemType = "product" | "service";

export interface PosCartItem {
  key: string;
  item_type: PosItemType;
  item_id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  stock_quantity?: number | null;
}

export interface PosPaymentLine {
  id: string;
  method: string;
  amount: number;
}

export interface PosSalePayment {
  id: string;
  sale_id: string;
  method: string;
  amount: number;
  created_at?: string;
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
  payments: Array<{ method: string; amount: number }>;
  discount_amount?: number;
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

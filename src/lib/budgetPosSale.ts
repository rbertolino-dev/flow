import { supabase } from "@/integrations/supabase/client";
import type { BudgetFinanceChoice, BudgetProduct, BudgetService } from "@/types/budget";
import type { FinalizeSalePayload, FinalizeSaleResult, PosItemType } from "@/types/pos";

export function budgetPosSaleRequestId(budgetId: string): string {
  return `orcamento:${budgetId}`;
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapLine(
  item: BudgetProduct | BudgetService,
  itemType: PosItemType,
): FinalizeSalePayload["items"][number] | null {
  const quantity = Number(item.quantity) || 0;
  if (quantity <= 0) return null;
  const unitPrice = Number(item.price) || 0;
  const expected = roundMoney(unitPrice * quantity);
  const subtotal = roundMoney(Number(item.subtotal ?? expected));
  const discount = Math.max(0, roundMoney(expected - subtotal));
  const manual = Boolean(item.isManual) || !isUuid(item.id);
  return {
    item_type: itemType,
    item_id: manual ? null : item.id,
    name: item.name || (itemType === "service" ? "Serviço" : "Produto"),
    quantity,
    unit_price: unitPrice,
    discount_amount: discount,
    unit: "un",
  };
}

export function buildBudgetPosSalePayload(input: {
  budgetId: string;
  budgetNumber?: string | null;
  total?: number | null;
  additions?: number | null;
  leadId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  products?: BudgetProduct[] | null;
  services?: BudgetService[] | null;
  choice: BudgetFinanceChoice;
}): FinalizeSalePayload | null {
  const items: FinalizeSalePayload["items"] = [];
  for (const product of input.products || []) {
    const line = mapLine(product, "product");
    if (line) items.push(line);
  }
  for (const service of input.services || []) {
    const line = mapLine(service, "service");
    if (line) items.push(line);
  }
  if (!items.length) return null;

  const itemsSubtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unit_price - (item.discount_amount || 0), 0),
  );
  const budgetTotal = roundMoney(Number(input.total) || 0);
  const additions = roundMoney(Number(input.additions) || 0);
  // Acréscimo do orçamento; se total < subtotal, trata diferença como desconto de venda
  let surcharge = Math.max(0, additions);
  let discount = 0;
  const expectedWithAdditions = roundMoney(itemsSubtotal + surcharge);
  if (budgetTotal > 0) {
    if (budgetTotal > expectedWithAdditions + 0.009) {
      surcharge = roundMoney(surcharge + (budgetTotal - expectedWithAdditions));
    } else if (budgetTotal < expectedWithAdditions - 0.009) {
      discount = roundMoney(expectedWithAdditions - budgetTotal);
    }
  }

  const saleTotal = roundMoney(itemsSubtotal - discount + surcharge);
  const paymentMethod = input.choice.paymentMethod || "pix";
  const financeLines = (input.choice.financeLines || []).filter((line) => Number(line.amount) > 0.009);
  const payments =
    financeLines.length > 0
      ? financeLines.map((line) => ({
          method: line.method || paymentMethod,
          amount: roundMoney(line.amount),
        }))
      : [{ method: paymentMethod, amount: saleTotal }];

  const paymentsSum = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));
  if (Math.abs(paymentsSum - saleTotal) > 0.009) {
    payments.length = 0;
    payments.push({ method: paymentMethod, amount: saleTotal });
  }

  const saleDate = input.choice.saleDate || new Date().toISOString().slice(0, 10);
  const saleTime = input.choice.saleTime || "12:00";
  const [hh, mm] = saleTime.split(":").map(Number);
  const [y, m, d] = saleDate.split("-").map(Number);
  const soldAt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).toISOString();

  return {
    items,
    payments,
    discount_amount: discount,
    surcharge_amount: surcharge,
    lead_id: input.leadId || null,
    customer_name: input.clientName || null,
    customer_phone: input.clientPhone || null,
    notes: input.choice.paymentNotes || input.choice.receiptDescription || null,
    sale_description:
      input.choice.saleDescription ||
      `Orçamento ${input.budgetNumber || ""}`.trim() ||
      null,
    sold_at: soldAt,
    payment_date: saleDate,
    apply_stock: false,
    generate_financial: false,
    add_commission: Boolean(
      input.choice.addCommission &&
        Number(input.choice.commissionAmount) > 0.009 &&
        input.choice.commissionUserId,
    ),
    commission_user_id: input.choice.commissionUserId || null,
    commission_user_name: input.choice.commissionUserName || null,
    sale_origin: "orcamento",
    client_request_id: budgetPosSaleRequestId(input.budgetId),
    financial_account: input.choice.account || null,
    financial_category: input.choice.category || null,
  };
}

export async function createPosSaleFromBudget(
  organizationId: string,
  payload: FinalizeSalePayload,
): Promise<FinalizeSaleResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-sales`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "X-Organization-Id": organizationId,
    },
    body: JSON.stringify({
      action: "finalize_sale",
      ...payload,
      sale_origin: payload.sale_origin || "orcamento",
      apply_stock: false,
      generate_financial: false,
      client_request_id: payload.client_request_id || budgetPosSaleRequestId(String(Date.now())),
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Erro ${response.status} ao criar venda do orçamento`);
  }
  return result.data as FinalizeSaleResult;
}

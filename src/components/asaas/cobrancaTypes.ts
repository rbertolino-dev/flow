export interface CobrancaFormPrefill {
  leadId?: string;
  budgetId?: string;
  posSaleId?: string;
  descricao?: string;
  valor?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCpfCnpj?: string;
  dataVencimento?: string;
  installmentCount?: number;
  referenciaExterna?: string;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  open: "Aberto",
  paid: "Pago",
  cancelled: "Cancelado",
  overdue: "Vencido",
  refunded: "Reembolsado",
};

export const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  open: "bg-blue-100 text-blue-800 border-blue-300",
  paid: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  overdue: "bg-orange-100 text-orange-800 border-orange-300",
  refunded: "bg-purple-100 text-purple-800 border-purple-300",
};

export function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function shortPaymentCode(asaasPaymentId?: string | null): string {
  if (!asaasPaymentId) return "—";
  return asaasPaymentId.length > 12 ? asaasPaymentId.slice(0, 12) : asaasPaymentId;
}

export function monthRangeIso(base = new Date()): { from: string; to: string } {
  const y = base.getFullYear();
  const m = base.getMonth();
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

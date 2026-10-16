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
  pending: "bg-amber-100 text-amber-900 border-amber-300 font-medium",
  open: "bg-sky-100 text-sky-900 border-sky-300 font-medium",
  paid: "bg-emerald-100 text-emerald-900 border-emerald-300 font-medium",
  cancelled: "bg-rose-100 text-rose-900 border-rose-300 font-medium",
  overdue: "bg-orange-100 text-orange-900 border-orange-400 font-medium",
  refunded: "bg-slate-200 text-slate-800 border-slate-400 font-medium",
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

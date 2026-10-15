import type { ServiceOrderItem } from '@/types/serviceOrder';
import type { FinanceEntryStatus } from '@/lib/finance';

export type OsFinanceEntrySummary = {
  id: string;
  direction: 'receber' | 'pagar';
  amount: number;
  status: FinanceEntryStatus;
  account: string | null;
  description: string | null;
  source_type: string;
  source_id: string;
};

export type OsFinanceStatus = {
  receivable: OsFinanceEntrySummary | null;
  commission: OsFinanceEntrySummary | null;
};

export function formatOsMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function financeStatusLabel(status: FinanceEntryStatus | null | undefined): string {
  if (status === 'paid') return 'Pago';
  if (status === 'open') return 'Em aberto';
  if (status === 'cancelled') return 'Cancelado';
  return 'Não lançado';
}

/** Itens cobrados do cliente (exclui insumos só de custo com preço zero). */
export function billableOrderItems(items: ServiceOrderItem[] | null | undefined): ServiceOrderItem[] {
  return (items || []).filter(
    (item) => !(item.item_type === 'product' && item.use_cost && Number(item.unit_price) === 0)
  );
}

export function orderItemsCost(items: ServiceOrderItem[] | null | undefined): number {
  return (items || []).reduce(
    (sum, item) => sum + (Number(item.unit_cost) || 0) * (Number(item.quantity) || 0),
    0
  );
}

export function pickActiveFinanceEntry(
  rows: OsFinanceEntrySummary[],
  sourceType: string,
  sourceId: string
): OsFinanceEntrySummary | null {
  const matches = rows.filter(
    (row) =>
      row.source_type === sourceType &&
      row.source_id === sourceId &&
      row.status !== 'cancelled'
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => {
    if (a.status === 'paid' && b.status !== 'paid') return -1;
    if (b.status === 'paid' && a.status !== 'paid') return 1;
    return 0;
  })[0];
}

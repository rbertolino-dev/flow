import { jsPDF } from 'jspdf';

export type FinanceDirection = 'receber' | 'pagar';
export type FinanceEntryStatus = 'open' | 'paid' | 'cancelled';
export type FinanceSettlement = 'previsto' | 'confirmado';
export type FinanceSourceType =
  | 'orcamento'
  | 'pdv'
  | 'ordem_servico'
  | 'boleto'
  | 'comissao'
  | 'manual';

export interface FinancialAccount {
  id: string;
  organization_id: string;
  name: string;
}

export interface FinancialCategory {
  id: string;
  organization_id: string;
  name: string;
  direction: 'receber' | 'pagar' | 'ambos';
}

export interface FinancialEntry {
  id: string;
  organization_id: string;
  direction: FinanceDirection;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: FinanceEntryStatus;
  settlement_status: FinanceSettlement;
  source_type: FinanceSourceType;
  source_id: string;
  lead_id: string | null;
  budget_id: string | null;
  description: string | null;
  contact_name: string | null;
  billing_name: string | null;
  category: string | null;
  account: string | null;
  origin_label: string;
  created_at: string;
}

export type FinanceBucket = 'overdue' | 'today' | 'upcoming' | 'paid';

export const financeCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatFinanceMoney(value: number): string {
  return financeCurrency.format(Number(value) || 0);
}

export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function monthRange(base = new Date()): { from: string; to: string } {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const iso = (d: Date) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };
  return { from: iso(start), to: iso(end) };
}

export function formatFinanceDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const datePart = iso.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year.slice(2)}`;
}

export function entryBucket(entry: FinancialEntry, today = todayIsoDate()): FinanceBucket {
  if (entry.status === 'paid') return 'paid';
  const due = entry.due_date.slice(0, 10);
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'upcoming';
}

export function entryInPeriod(entry: FinancialEntry, from: string, to: string): boolean {
  const due = entry.due_date.slice(0, 10);
  if (due >= from && due <= to) return true;
  if (entry.status === 'paid' && entry.paid_at) {
    const paid = entry.paid_at.slice(0, 10);
    return paid >= from && paid <= to;
  }
  return false;
}

export function exportFinanceCsv(filename: string, rows: FinancialEntry[], direction: FinanceDirection) {
  const header = direction === 'receber'
    ? ['Valor', 'Origem', 'Faturamento', 'Cliente', 'Descrição', 'Vencimento', 'Categoria', 'Conta', 'Status']
    : ['Valor', 'Origem', 'Contato/Empresa', 'Descrição', 'Vencimento', 'Categoria', 'Conta', 'Status'];

  const lines = rows.map((row) => {
    const status = row.status === 'paid'
      ? (direction === 'receber' ? 'Recebida' : 'Paga')
      : row.settlement_status === 'previsto'
        ? 'Previsto'
        : 'Em aberto';
    const common = [
      String(row.amount).replace('.', ','),
      row.origin_label || 'Normal',
    ];
    if (direction === 'receber') {
      return [
        ...common,
        row.billing_name || 'Sem contato',
        row.contact_name || '',
        row.description || '',
        formatFinanceDate(row.due_date),
        row.category || '',
        row.account || '',
        status,
      ];
    }
    return [
      ...common,
      row.contact_name || '',
      row.description || '',
      formatFinanceDate(row.due_date),
      row.category || '',
      row.account || '',
      status,
    ];
  });

  const csv = [header, ...lines]
    .map((cols) => cols.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportFinancePdf(title: string, rows: FinancialEntry[], direction: FinanceDirection) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(8);

  const headers = direction === 'receber'
    ? ['Valor', 'Origem', 'Faturamento', 'Cliente', 'Descrição', 'Vencimento', 'Categoria', 'Conta']
    : ['Valor', 'Origem', 'Contato', 'Descrição', 'Vencimento', 'Categoria', 'Conta'];

  let y = 22;
  doc.text(headers.join('  |  '), 14, y);
  y += 6;

  rows.slice(0, 40).forEach((row) => {
    const cols = direction === 'receber'
      ? [
          formatFinanceMoney(row.amount),
          row.origin_label || 'Normal',
          row.billing_name || 'Sem contato',
          row.contact_name || '',
          (row.description || '').slice(0, 28),
          formatFinanceDate(row.due_date),
          row.category || '',
          row.account || '',
        ]
      : [
          formatFinanceMoney(row.amount),
          row.origin_label || 'Normal',
          row.contact_name || '',
          (row.description || '').slice(0, 36),
          formatFinanceDate(row.due_date),
          row.category || '',
          row.account || '',
        ];
    doc.text(cols.join('  |  '), 14, y);
    y += 5;
    if (y > 190) {
      doc.addPage();
      y = 16;
    }
  });

  if (rows.length > 40) {
    doc.text(`+ ${rows.length - 40} lançamentos no CSV completo`, 14, y + 4);
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

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
  bank_name: string | null;
  account_type: string | null;
  last_digits: string | null;
}

export const WALLET_BANKS = [
  'Banco do Brasil',
  'Bradesco',
  'Caixa Econômica',
  'Cora',
  'Inter',
  'Itaú',
  'Mercado Pago',
  'NuBank',
  'PagBank',
  'Santander',
  'Sicoob',
  'Sicredi',
  'Outro',
] as const;

export const WALLET_ACCOUNT_TYPES = [
  'Conta Corrente',
  'Conta Poupança',
  'Conta de Investimento',
  'Cartão de Crédito',
  'Caixa',
] as const;

export function accountCashBalance(entries: FinancialEntry[], accountName: string): number {
  const key = accountName.trim().toLowerCase();
  return entries.reduce((sum, entry) => {
    if ((entry.account || '').trim().toLowerCase() !== key || entry.status !== 'paid') return sum;
    const amount = Number(entry.amount) || 0;
    return sum + (entry.direction === 'receber' ? amount : -amount);
  }, 0);
}

export type DreClass =
  | 'receita_vendas'
  | 'receita_servicos'
  | 'outras_receitas'
  | 'custo'
  | 'despesa_operacional'
  | 'despesa_financeira'
  | 'impostos';

export const DRE_CLASSES: Array<{ value: DreClass; label: string; direction: FinanceDirection }> = [
  { value: 'receita_vendas', label: 'Receita de vendas', direction: 'receber' },
  { value: 'receita_servicos', label: 'Receita de serviços', direction: 'receber' },
  { value: 'outras_receitas', label: 'Outras receitas', direction: 'receber' },
  { value: 'custo', label: 'Custo', direction: 'pagar' },
  { value: 'despesa_operacional', label: 'Despesa operacional', direction: 'pagar' },
  { value: 'despesa_financeira', label: 'Despesa financeira', direction: 'pagar' },
  { value: 'impostos', label: 'Impostos', direction: 'pagar' },
];

export interface FinancialCategory {
  id: string;
  organization_id: string;
  name: string;
  direction: 'receber' | 'pagar' | 'ambos';
  dre_class: DreClass | null;
}

export interface FinancialEntry {
  id: string;
  organization_id: string;
  direction: FinanceDirection;
  amount: number;
  due_date: string;
  competence_date: string | null;
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
  category_id: string | null;
  account: string | null;
  origin_label: string;
  payment_method?: string | null;
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

export function entryDueInPeriod(entry: FinancialEntry, from: string, to: string): boolean {
  const due = entry.due_date.slice(0, 10);
  return due >= from && due <= to;
}

export function entryPaidInPeriod(entry: FinancialEntry, from: string, to: string): boolean {
  if (entry.status !== 'paid' || !entry.paid_at) return false;
  const paid = entry.paid_at.slice(0, 10);
  return paid >= from && paid <= to;
}

export function entryInPeriod(entry: FinancialEntry, from: string, to: string): boolean {
  return entryDueInPeriod(entry, from, to) || entryPaidInPeriod(entry, from, to);
}

export function entryInCompetencePeriod(entry: FinancialEntry, from: string, to: string): boolean {
  const competence = (entry.competence_date || entry.due_date || '').slice(0, 10);
  return competence >= from && competence <= to;
}

export function dreClassLabel(value: string | null | undefined): string {
  return DRE_CLASSES.find((item) => item.value === value)?.label || 'Sem classificação';
}

export function paymentTimestamp(date: string): string {
  return `${date}T15:00:00.000Z`;
}

export function exportFinanceCsv(filename: string, rows: FinancialEntry[], direction: FinanceDirection) {
  const header = direction === 'receber'
    ? ['Valor', 'Origem', 'Faturamento', 'Cliente', 'Descrição', 'Data prevista', 'Data de pagamento', 'Data de competência', 'Categoria', 'Conta', 'Status']
    : ['Valor', 'Origem', 'Contato/Empresa', 'Descrição', 'Data prevista', 'Data de pagamento', 'Data de competência', 'Categoria', 'Conta', 'Status'];

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
        formatFinanceDate(row.paid_at),
        formatFinanceDate(row.competence_date || row.due_date),
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
      formatFinanceDate(row.paid_at),
      formatFinanceDate(row.competence_date || row.due_date),
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
    ? ['Valor', 'Origem', 'Cliente', 'Descrição', 'Prevista', 'Pagamento', 'Competência', 'Categoria']
    : ['Valor', 'Origem', 'Contato', 'Descrição', 'Prevista', 'Pagamento', 'Competência', 'Categoria'];

  let y = 22;
  doc.text(headers.join('  |  '), 14, y);
  y += 6;

  rows.slice(0, 40).forEach((row) => {
    const cols = direction === 'receber'
      ? [
          formatFinanceMoney(row.amount),
          row.origin_label || 'Normal',
          row.contact_name || '',
          (row.description || '').slice(0, 24),
          formatFinanceDate(row.due_date),
          formatFinanceDate(row.paid_at),
          formatFinanceDate(row.competence_date || row.due_date),
          row.category || '',
        ]
      : [
          formatFinanceMoney(row.amount),
          row.origin_label || 'Normal',
          row.contact_name || '',
          (row.description || '').slice(0, 28),
          formatFinanceDate(row.due_date),
          formatFinanceDate(row.paid_at),
          formatFinanceDate(row.competence_date || row.due_date),
          row.category || '',
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

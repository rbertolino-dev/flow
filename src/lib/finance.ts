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
  | 'receita_bruta_vendas'
  | 'receitas_financeiras'
  | 'outras_receitas'
  | 'recuperacao_despesas'
  | 'custo_mercadoria'
  | 'custo_servicos'
  | 'despesas_gerais'
  | 'despesas_administrativas'
  | 'despesas_pessoal'
  | 'despesas_vendas_marketing'
  | 'despesas_financeiras'
  | 'outros_custos'
  | 'impostos_lucro'
  | 'impostos'
  | 'deducoes_receita'
  | 'outros_tributos';

export const DRE_CLASSES: Array<{ value: DreClass; label: string; direction: FinanceDirection }> = [
  { value: 'receita_bruta_vendas', label: 'Receita Bruta de Vendas', direction: 'receber' },
  { value: 'receitas_financeiras', label: 'Receitas Financeiras', direction: 'receber' },
  { value: 'outras_receitas', label: 'Outras Receitas', direction: 'receber' },
  { value: 'recuperacao_despesas', label: 'Recuperação de Despesas Variáveis', direction: 'receber' },
  { value: 'custo_mercadoria', label: 'Custo de Mercadoria Vendida', direction: 'pagar' },
  { value: 'custo_servicos', label: 'Custo dos Serviços Prestados', direction: 'pagar' },
  { value: 'despesas_gerais', label: 'Despesas Gerais', direction: 'pagar' },
  { value: 'despesas_administrativas', label: 'Despesas Administrativas', direction: 'pagar' },
  { value: 'despesas_pessoal', label: 'Despesas com Pessoal', direction: 'pagar' },
  { value: 'despesas_vendas_marketing', label: 'Despesas de Vendas e Marketing', direction: 'pagar' },
  { value: 'despesas_financeiras', label: 'Despesas Financeiras', direction: 'pagar' },
  { value: 'outros_custos', label: 'Outros Custos', direction: 'pagar' },
  { value: 'impostos_lucro', label: 'Impostos sobre Lucro', direction: 'pagar' },
  { value: 'impostos', label: 'Impostos', direction: 'pagar' },
  { value: 'deducoes_receita', label: 'Deduções de Receita', direction: 'pagar' },
  { value: 'outros_tributos', label: 'Outros Tributos', direction: 'pagar' },
];

const LEGACY_DRE_CLASS: Record<string, DreClass> = {
  receita_vendas: 'receita_bruta_vendas',
  receita_servicos: 'receita_bruta_vendas',
  custo: 'custo_mercadoria',
  despesa_operacional: 'despesas_gerais',
  despesa_financeira: 'despesas_financeiras',
};

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
  is_recurring?: boolean | null;
  recurrence_group_id?: string | null;
  recurrence_index?: number | null;
  recurrence_total?: number | null;
  attachment_name?: string | null;
  attachment_path?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type FinanceBucket = 'overdue' | 'today' | 'upcoming' | 'paid';

export const financeCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatFinanceMoney(value: number): string {
  return financeCurrency.format(Number(value) || 0);
}

export function parseParcelDescription(description: string | null | undefined): { index: number; total: number; base: string } | null {
  if (!description) return null;
  const current = description.match(/^PARC\.\s*(\d+)\s*\/\s*(\d+)\s*:\s*(.*)$/i);
  if (current) {
    return { index: Number(current[1]), total: Number(current[2]), base: current[3].trim() };
  }
  const legacy = description.match(/^(.*)\s\((\d+)\/(\d+)\)$/);
  if (!legacy) return null;
  return { index: Number(legacy[2]), total: Number(legacy[3]), base: legacy[1].trim() };
}

export function formatParcelDescription(index: number, total: number, base: string): string {
  return `PARC. ${index}/${total}: ${base.trim()}`;
}

export function remainingInstallments(entry: FinancialEntry, all: FinancialEntry[]): number {
  if (!entry.is_recurring && !entry.recurrence_group_id) return 0;
  if (entry.recurrence_group_id) {
    return all.filter((item) =>
      item.id !== entry.id
      && item.recurrence_group_id === entry.recurrence_group_id
      && item.status === 'open'
      && Number(item.recurrence_index || 0) > Number(entry.recurrence_index || 0)
    ).length;
  }
  const parsed = parseParcelDescription(entry.description);
  if (!parsed) return 0;
  return Math.max(0, parsed.total - parsed.index);
}

export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const CASH_FLOW_MAX_MONTHS = 6;

function isoFromDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function cashFlowDefaultRange(base = new Date()): { from: string; to: string } {
  const start = new Date(base.getFullYear(), base.getMonth() - (CASH_FLOW_MAX_MONTHS - 1), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { from: isoFromDate(start), to: isoFromDate(end) };
}

export function cashFlowMonthCount(from: string, to: string): number {
  const [fromYear, fromMonth] = from.slice(0, 7).split('-').map(Number);
  const [toYear, toMonth] = to.slice(0, 7).split('-').map(Number);
  if (!fromYear || !fromMonth || !toYear || !toMonth) return 0;
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

export interface CashFlowMonth {
  key: string;
  label: string;
  includesForecast: boolean;
}

export interface CashFlowCell {
  amount: number;
  hasEntries: boolean;
}

export interface CashFlowCategoryRow {
  name: string;
  cells: CashFlowCell[];
}

export interface CashFlowReport {
  months: CashFlowMonth[];
  entrada: CashFlowCell[];
  saida: CashFlowCell[];
  saldo: number[];
  entradaCategories: CashFlowCategoryRow[];
  saidaCategories: CashFlowCategoryRow[];
  periodBalance: number;
}

export function cashFlowMonths(from: string, to: string, today = todayIsoDate()): CashFlowMonth[] {
  const total = cashFlowMonthCount(from, to);
  if (total < 1) return [];
  const [yearText, monthText] = from.slice(0, 7).split('-');
  let year = Number(yearText);
  let month = Number(monthText);
  const currentKey = today.slice(0, 7);
  const months: CashFlowMonth[] = [];
  const count = Math.min(total, CASH_FLOW_MAX_MONTHS);
  for (let index = 0; index < count; index += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push({
      key,
      label: `${MONTH_NAMES[month - 1]}, ${year}`,
      includesForecast: key >= currentKey,
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function cashFlowCategoryName(entry: FinancialEntry, categories: FinancialCategory[]): string {
  const linked = entry.category_id
    ? categories.find((category) => category.id === entry.category_id)
    : categories.find((category) => category.name === entry.category && (category.direction === entry.direction || category.direction === 'ambos'));
  return linked?.name || entry.category || 'Sem categoria';
}

function cashFlowMonthKey(entry: FinancialEntry, allowed: Set<string>, currentKey: string): string | null {
  if (entry.status === 'cancelled') return null;
  if (entry.status === 'paid' && entry.paid_at) {
    const key = entry.paid_at.slice(0, 7);
    return allowed.has(key) ? key : null;
  }
  if (entry.status !== 'open' || !entry.due_date) return null;
  const key = entry.due_date.slice(0, 7);
  if (key < currentKey || !allowed.has(key)) return null;
  return key;
}

export function buildCashFlow(
  entries: FinancialEntry[],
  categories: FinancialCategory[],
  from: string,
  to: string,
  today = todayIsoDate(),
): CashFlowReport {
  const months = cashFlowMonths(from, to, today);
  const allowed = new Set(months.map((month) => month.key));
  const currentKey = today.slice(0, 7);
  const entradaMap = new Map<string, Map<string, { amount: number; count: number }>>();
  const saidaMap = new Map<string, Map<string, { amount: number; count: number }>>();

  entries.forEach((entry) => {
    const key = cashFlowMonthKey(entry, allowed, currentKey);
    if (!key) return;
    const bucket = entry.direction === 'receber' ? entradaMap : saidaMap;
    const name = cashFlowCategoryName(entry, categories);
    const row = bucket.get(name) || new Map<string, { amount: number; count: number }>();
    const cell = row.get(key) || { amount: 0, count: 0 };
    cell.amount += Number(entry.amount) || 0;
    cell.count += 1;
    row.set(key, cell);
    bucket.set(name, row);
  });

  const toRows = (source: Map<string, Map<string, { amount: number; count: number }>>): CashFlowCategoryRow[] => (
    Array.from(source.entries())
      .map(([name, values]) => ({
        name,
        cells: months.map((month) => {
          const cell = values.get(month.key);
          return { amount: cell?.amount || 0, hasEntries: (cell?.count || 0) > 0 };
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  );

  const sumColumn = (rows: CashFlowCategoryRow[], index: number): CashFlowCell => {
    const used = rows.filter((row) => row.cells[index]?.hasEntries);
    return {
      amount: used.reduce((sum, row) => sum + row.cells[index].amount, 0),
      hasEntries: used.length > 0,
    };
  };

  const entradaCategories = toRows(entradaMap);
  const saidaCategories = toRows(saidaMap);
  const entrada = months.map((_, index) => sumColumn(entradaCategories, index));
  const saida = months.map((_, index) => sumColumn(saidaCategories, index));
  const saldo = months.map((_, index) => entrada[index].amount - saida[index].amount);

  return {
    months,
    entrada,
    saida,
    saldo,
    entradaCategories,
    saidaCategories,
    periodBalance: saldo.reduce((sum, value) => sum + value, 0),
  };
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

export function normalizeDreClass(value: string | null | undefined): DreClass | null {
  if (!value) return null;
  if (DRE_CLASSES.some((item) => item.value === value)) return value as DreClass;
  return LEGACY_DRE_CLASS[value] || null;
}

export function dreClassLabel(value: string | null | undefined): string {
  const normalized = normalizeDreClass(value);
  return DRE_CLASSES.find((item) => item.value === normalized)?.label || 'Sem classificação';
}

export type DreMode = 'realizacao' | 'competencia';

export interface DreReportLine {
  key: string;
  label: string;
  prefix: '(+)' | '(-)' | '(=)';
  amount: number;
  total: boolean;
}

const DRE_TOTALS: Array<{ key: string; label: string; parts: DreClass[] }> = [
  { key: 'lucro_bruto', label: 'Lucro Bruto', parts: ['receita_bruta_vendas', 'custo_mercadoria', 'custo_servicos'] },
  {
    key: 'resultado_operacional',
    label: 'Resultado Operacional',
    parts: [
      'receita_bruta_vendas',
      'custo_mercadoria',
      'custo_servicos',
      'receitas_financeiras',
      'outras_receitas',
      'despesas_gerais',
      'despesas_administrativas',
      'despesas_pessoal',
      'despesas_vendas_marketing',
      'despesas_financeiras',
      'outros_custos',
    ],
  },
  {
    key: 'resultado_liquido',
    label: 'Resultado Líquido',
    parts: [
      'receita_bruta_vendas',
      'custo_mercadoria',
      'custo_servicos',
      'receitas_financeiras',
      'outras_receitas',
      'despesas_gerais',
      'despesas_administrativas',
      'despesas_pessoal',
      'despesas_vendas_marketing',
      'despesas_financeiras',
      'outros_custos',
      'recuperacao_despesas',
      'impostos_lucro',
      'impostos',
      'deducoes_receita',
      'outros_tributos',
    ],
  },
];

const DRE_REPORT_ORDER: Array<{ key: DreClass | 'lucro_bruto' | 'resultado_operacional' | 'resultado_liquido' }> = [
  { key: 'receita_bruta_vendas' },
  { key: 'custo_mercadoria' },
  { key: 'custo_servicos' },
  { key: 'lucro_bruto' },
  { key: 'receitas_financeiras' },
  { key: 'outras_receitas' },
  { key: 'despesas_gerais' },
  { key: 'despesas_administrativas' },
  { key: 'despesas_pessoal' },
  { key: 'despesas_vendas_marketing' },
  { key: 'despesas_financeiras' },
  { key: 'outros_custos' },
  { key: 'resultado_operacional' },
  { key: 'recuperacao_despesas' },
  { key: 'impostos_lucro' },
  { key: 'impostos' },
  { key: 'deducoes_receita' },
  { key: 'outros_tributos' },
  { key: 'resultado_liquido' },
];

export function resolveEntryDreClass(entry: FinancialEntry, categories: FinancialCategory[]): DreClass | null {
  const linked = (entry.category_id ? categories.find((category) => category.id === entry.category_id) : undefined)
    || categories.find((category) => category.name === entry.category && (category.direction === entry.direction || category.direction === 'ambos'));
  return normalizeDreClass(linked?.dre_class);
}

function dreSigned(dreClass: DreClass, sums: Map<DreClass, number>): number {
  const direction = DRE_CLASSES.find((item) => item.value === dreClass)?.direction;
  const sign = direction === 'receber' ? 1 : -1;
  return sign * (sums.get(dreClass) || 0);
}

export function buildDreReport(
  entries: FinancialEntry[],
  categories: FinancialCategory[],
  mode: DreMode,
  from: string,
  to: string,
): DreReportLine[] {
  const sums = new Map<DreClass, number>();
  entries.forEach((entry) => {
    if (entry.status === 'cancelled') return;
    const inPeriod = mode === 'realizacao'
      ? entryPaidInPeriod(entry, from, to)
      : entryInCompetencePeriod(entry, from, to);
    if (!inPeriod) return;
    const dreClass = resolveEntryDreClass(entry, categories);
    if (!dreClass) return;
    sums.set(dreClass, (sums.get(dreClass) || 0) + (Number(entry.amount) || 0));
  });

  return DRE_REPORT_ORDER.map((item) => {
    const total = DRE_TOTALS.find((row) => row.key === item.key);
    if (total) {
      const amount = total.parts.reduce((sum, part) => sum + dreSigned(part, sums), 0);
      return { key: total.key, label: total.label, prefix: '(=)' as const, amount, total: true };
    }
    const line = DRE_CLASSES.find((row) => row.value === item.key);
    return {
      key: item.key,
      label: line?.label || item.key,
      prefix: line?.direction === 'receber' ? '(+)' as const : '(-)' as const,
      amount: sums.get(item.key as DreClass) || 0,
      total: false,
    };
  });
}

export function drePeriodHasGap(entries: FinancialEntry[], categories: FinancialCategory[], mode: DreMode, from: string, to: string): boolean {
  if (categories.some((category) => !normalizeDreClass(category.dre_class))) return true;
  return entries.some((entry) => {
    if (entry.status === 'cancelled') return false;
    const inPeriod = mode === 'realizacao'
      ? entryPaidInPeriod(entry, from, to)
      : entryInCompetencePeriod(entry, from, to);
    return inPeriod && !resolveEntryDreClass(entry, categories);
  });
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

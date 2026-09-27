import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { FinanceSubnav } from '@/components/finance/FinanceSubnav';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useFinancialLedger } from '@/hooks/useFinancialLedger';
import { useToast } from '@/hooks/use-toast';
import {
  buildCashFlow,
  CASH_FLOW_MAX_MONTHS,
  cashFlowDefaultRange,
  cashFlowMonthCount,
  formatFinanceMoney,
  type CashFlowCategoryRow,
  type CashFlowCell,
  type CashFlowMonth,
  type FinancialEntry,
} from '@/lib/finance';
import { cn } from '@/lib/utils';

interface PageResult {
  data: unknown;
  error: { message: string } | null;
}

interface CashQuery extends Promise<PageResult> {
  select(columns: string): CashQuery;
  eq(column: string, value: string): CashQuery;
  or(filters: string): CashQuery;
  order(column: string, options?: { ascending: boolean }): CashQuery;
  range(from: number, to: number): CashQuery;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const COLUMNS = 'id, organization_id, direction, amount, due_date, paid_at, status, category, category_id';

function db() {
  return supabase as unknown as { from: (table: string) => CashQuery };
}

function asEntry(row: Record<string, unknown>): FinancialEntry {
  const direction = row.direction === 'pagar' ? 'pagar' : 'receber';
  const status = row.status === 'paid' || row.status === 'cancelled' ? row.status : 'open';
  return {
    id: String(row.id || ''),
    organization_id: String(row.organization_id || ''),
    direction,
    amount: Number(row.amount) || 0,
    due_date: String(row.due_date || ''),
    competence_date: null,
    paid_at: row.paid_at ? String(row.paid_at) : null,
    status,
    settlement_status: 'confirmado',
    source_type: 'manual',
    source_id: String(row.id || ''),
    lead_id: null,
    budget_id: null,
    description: null,
    contact_name: null,
    billing_name: null,
    category: row.category ? String(row.category) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    account: null,
    origin_label: 'Normal',
    created_at: '',
  };
}

async function loadCashFlowEntries(organizationId: string, from: string, to: string): Promise<FinancialEntry[]> {
  const paidFrom = `${from}T00:00:00.000Z`;
  const paidTo = `${to}T23:59:59.999Z`;
  const rows: FinancialEntry[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE_SIZE;
    const result = await db()
      .from('financial_entries')
      .select(COLUMNS)
      .eq('organization_id', organizationId)
      .or(`and(status.eq.paid,paid_at.gte."${paidFrom}",paid_at.lte."${paidTo}"),and(status.eq.open,due_date.gte.${from},due_date.lte.${to})`)
      .order('id', { ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
    const batch = ((result.data || []) as Record<string, unknown>[]).map(asEntry);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

function categoryAmount(cell: CashFlowCell, month: CashFlowMonth) {
  if (!cell.hasEntries) return null;
  return (
    <span className={cn(month.includesForecast ? 'font-semibold text-blue-600' : 'text-slate-800')}>
      {formatFinanceMoney(cell.amount)}
    </span>
  );
}

export default function FinanceCashFlow() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { categories } = useFinancialLedger();
  const initialRange = cashFlowDefaultRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [draftFrom, setDraftFrom] = useState(initialRange.from);
  const [draftTo, setDraftTo] = useState(initialRange.to);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [saidaOpen, setSaidaOpen] = useState(false);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const draftCount = cashFlowMonthCount(draftFrom, draftTo);
  const draftInvalid = !draftFrom || !draftTo || draftFrom > draftTo || draftCount < 1 || draftCount > CASH_FLOW_MAX_MONTHS;

  useEffect(() => {
    if (!activeOrgId || !from || !to || from > to) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadCashFlowEntries(activeOrgId, from, to)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Erro ao carregar fluxo de caixa:', error);
        setEntries([]);
        toast({
          title: 'Fluxo de Caixa',
          description: error instanceof Error ? error.message : 'Não foi possível carregar o fluxo de caixa',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, from, to, toast]);

  const report = useMemo(
    () => buildCashFlow(entries, categories, from, to),
    [entries, categories, from, to],
  );

  const applyFilters = () => {
    if (draftInvalid) return;
    setFrom(draftFrom);
    setTo(draftTo);
    setFiltersOpen(false);
  };

  return (
    <CRMLayout activeView="finance" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <FinanceSubnav />
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="bg-slate-100 px-4 py-4">
            <h1 className="text-2xl font-semibold text-slate-500">Fluxo de Caixa</h1>
          </div>
          <div className="flex justify-end px-4 pt-3">
            <Button
              type="button"
              variant="outline"
              className="bg-slate-100 text-blue-700 hover:bg-slate-200"
              onClick={() => {
                setDraftFrom(from);
                setDraftTo(to);
                setFiltersOpen(true);
              }}
            >
              Visualização
            </Button>
          </div>
          <p className="px-4 py-3 text-sm text-slate-600">
            Para os meses anteriores, são mostrados apenas lançamentos confirmados como pagos e recebidos. Para o mês atual e meses futuros são mostrados também lançamentos previstos.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 px-4 pb-6 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700">
                      <th className="sticky left-0 z-10 border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold">Mês</th>
                      {report.months.map((month) => (
                        <th key={month.key} className="border border-slate-200 px-3 py-2 text-center font-semibold">{month.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th className="sticky left-0 z-10 border border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-700">
                        <button type="button" className="inline-flex items-center gap-2" onClick={() => setEntradaOpen((open) => !open)}>
                          {entradaOpen ? <ChevronDown className="h-4 w-4 text-green-600" /> : <ChevronRight className="h-4 w-4 text-green-600" />}
                          <Check className="h-4 w-4 text-green-600" />
                          Total Entrada
                        </button>
                      </th>
                      {report.entrada.map((cell, index) => (
                        <td key={report.months[index].key} className="border border-slate-200 bg-green-50 px-3 py-2 text-right font-semibold text-green-700">
                          {formatFinanceMoney(cell.amount)}
                        </td>
                      ))}
                    </tr>
                    {entradaOpen && report.entradaCategories.map((row) => (
                      <CategoryRow key={`entrada-${row.name}`} row={row} months={report.months} accent="green" />
                    ))}
                    <tr>
                      <th className="sticky left-0 z-10 border border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-700">
                        <button type="button" className="inline-flex items-center gap-2" onClick={() => setSaidaOpen((open) => !open)}>
                          {saidaOpen ? <ChevronDown className="h-4 w-4 text-red-600" /> : <ChevronRight className="h-4 w-4 text-red-600" />}
                          <ArrowDown className="h-4 w-4 text-red-600" />
                          Total Saida
                        </button>
                      </th>
                      {report.saida.map((cell, index) => (
                        <td key={report.months[index].key} className="border border-slate-200 bg-red-50 px-3 py-2 text-right font-semibold text-red-600">
                          {formatFinanceMoney(cell.amount)}
                        </td>
                      ))}
                    </tr>
                    {saidaOpen && report.saidaCategories.map((row) => (
                      <CategoryRow key={`saida-${row.name}`} row={row} months={report.months} accent="red" />
                    ))}
                    <tr>
                      <th className="sticky left-0 z-10 border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">Saldo</th>
                      {report.saldo.map((amount, index) => (
                        <td key={report.months[index].key} className={cn('border border-slate-200 bg-slate-100 px-3 py-2 text-right font-medium', amount < 0 ? 'text-red-600' : 'text-slate-800')}>
                          {formatFinanceMoney(amount)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="m-4 inline-flex items-center gap-3 rounded border border-slate-200 px-3 py-2 text-sm">
                <span className="text-slate-600">Saldo do período:</span>
                <span className={cn('font-semibold', report.periodBalance < 0 ? 'text-red-600' : 'text-blue-700')}>
                  {formatFinanceMoney(report.periodBalance)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Visualização do Fluxo de Caixa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Select value="mensal">
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="bg-white" />
              <span className="text-sm text-slate-500">até</span>
              <Input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="bg-white" />
            </div>
            <p className={cn('text-sm', draftCount > CASH_FLOW_MAX_MONTHS ? 'text-red-600' : 'text-slate-500')}>
              Limite de 6 meses por visualização
            </p>
            <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" disabled={draftInvalid} onClick={applyFilters}>
              Visualizar Fluxo de Caixa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

function CategoryRow({ row, months, accent }: { row: CashFlowCategoryRow; months: CashFlowMonth[]; accent: 'green' | 'red' }) {
  return (
    <tr>
      <th className={cn('sticky left-0 z-10 border border-slate-200 border-l-4 bg-white px-3 py-2 text-left font-normal text-slate-700', accent === 'green' ? 'border-l-green-500' : 'border-l-red-500')}>
        {row.name}
      </th>
      {row.cells.map((cell, index) => (
        <td key={months[index].key} className="border border-slate-200 px-3 py-2 text-right">
          {categoryAmount(cell, months[index])}
        </td>
      ))}
    </tr>
  );
}

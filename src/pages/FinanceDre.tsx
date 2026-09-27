import { useEffect, useMemo, useState } from 'react';
import { FileBarChart, Info, Loader2 } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { FinanceSubnav } from '@/components/finance/FinanceSubnav';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useFinancialLedger } from '@/hooks/useFinancialLedger';
import { useToast } from '@/hooks/use-toast';
import {
  buildDreReport,
  drePeriodHasGap,
  formatFinanceMoney,
  monthRange,
  type DreMode,
  type FinancialEntry,
} from '@/lib/finance';
import { cn } from '@/lib/utils';

interface PageResult {
  data: unknown;
  error: { message: string } | null;
}

interface DreQuery extends Promise<PageResult> {
  select(columns: string): DreQuery;
  eq(column: string, value: string): DreQuery;
  neq(column: string, value: string): DreQuery;
  gte(column: string, value: string): DreQuery;
  lte(column: string, value: string): DreQuery;
  or(filters: string): DreQuery;
  order(column: string, options?: { ascending: boolean }): DreQuery;
  range(from: number, to: number): DreQuery;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

const COLUMNS = 'id, organization_id, direction, amount, due_date, competence_date, paid_at, status, category, category_id';

function db() {
  return supabase as unknown as { from: (table: string) => DreQuery };
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
    competence_date: row.competence_date ? String(row.competence_date) : null,
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

async function loadDreEntries(organizationId: string, mode: DreMode, from: string, to: string): Promise<FinancialEntry[]> {
  const rows: FinancialEntry[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = db()
      .from('financial_entries')
      .select(COLUMNS)
      .eq('organization_id', organizationId)
      .neq('status', 'cancelled');

    if (mode === 'realizacao') {
      query = query
        .eq('status', 'paid')
        .gte('paid_at', `${from}T00:00:00.000Z`)
        .lte('paid_at', `${to}T23:59:59.999Z`)
        .order('paid_at', { ascending: true });
    } else {
      query = query
        .or(`and(competence_date.gte.${from},competence_date.lte.${to}),and(competence_date.is.null,due_date.gte.${from},due_date.lte.${to})`)
        .order('competence_date', { ascending: true });
    }

    const start = page * PAGE_SIZE;
    const result = await query.range(start, start + PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
    const batch = ((result.data || []) as Record<string, unknown>[]).map(asEntry);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export default function FinanceDre() {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const { categories, loading: categoriesLoading } = useFinancialLedger();
  const initialRange = monthRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [mode, setMode] = useState<DreMode>('realizacao');
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  useEffect(() => {
    if (!activeOrgId || !from || !to || from > to) {
      setEntries([]);
      setLoadingEntries(false);
      return;
    }
    let cancelled = false;
    setLoadingEntries(true);
    void loadDreEntries(activeOrgId, mode, from, to)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Erro ao carregar DRE:', error);
        setEntries([]);
        toast({
          title: 'Relatório DRE',
          description: error instanceof Error ? error.message : 'Não foi possível carregar o relatório',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingEntries(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, from, to, mode, toast]);

  const lines = useMemo(
    () => buildDreReport(entries, categories, mode, from, to),
    [entries, categories, mode, from, to],
  );
  const showGap = useMemo(
    () => drePeriodHasGap(entries, categories, mode, from, to),
    [entries, categories, mode, from, to],
  );
  const loading = categoriesLoading || loadingEntries;

  return (
    <CRMLayout activeView="finance" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1100px] p-4 md:p-6">
        <FinanceSubnav />
        <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 text-slate-700">
          <FileBarChart className="h-5 w-5" aria-hidden />
          <h1 className="text-xl font-semibold">Relatório DRE</h1>
        </div>

        {showGap && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>Adicione uma classificação DRE às categorias na sua carteira para ter o seu Relatório DRE completo.</p>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <Label>Período:</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-[160px] bg-white" />
              <span className="text-sm text-slate-500">até</span>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-[160px] bg-white" />
            </div>
          </div>
          <div className="min-w-[220px]">
            <Label>Modo:</Label>
            <Select value={mode} onValueChange={(value: DreMode) => setMode(value)}>
              <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="realizacao">Data de realização</SelectItem>
                <SelectItem value="competencia">Data de competência</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {lines.map((line) => (
              <div
                key={line.key}
                className={cn(
                  'flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-2.5 text-sm text-slate-700 last:border-b-0',
                  line.total && 'bg-white font-semibold',
                )}
              >
                <span>{line.prefix} {line.label}</span>
                <span className={cn('tabular-nums', line.total && line.amount < 0 && 'text-red-600')}>
                  {formatFinanceMoney(line.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </CRMLayout>
  );
}

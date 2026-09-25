import { useMemo, useState } from 'react';
import { Check, FileDown, Loader2, Plus, Search, X } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { FinanceSubnav } from '@/components/finance/FinanceSubnav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { FinanceEntryDialog } from '@/components/finance/FinanceEntryDialog';
import { useFinancialLedger } from '@/hooks/useFinancialLedger';
import { getPaymentMethodLabel, type PaymentMethod } from "@/lib/paymentMethods";
import {
  entryBucket,
  entryInPeriod,
  exportFinanceCsv,
  exportFinancePdf,
  formatFinanceDate,
  formatFinanceMoney,
  monthRange,
  paymentTimestamp,
  todayIsoDate,
  type FinanceDirection,
  type FinancialEntry,
} from '@/lib/finance';

interface FinanceLedgerPageProps {
  direction: FinanceDirection;
}

const CARD_STYLES = {
  overdue: 'bg-red-500 text-white',
  today: 'bg-orange-500 text-white',
  upcoming: 'bg-yellow-400 text-slate-900',
  paid: 'bg-green-600 text-white',
} as const;

export function FinanceLedgerPage({ direction }: FinanceLedgerPageProps) {
  const { toast } = useToast();
  const { entries, accounts, categories, loading, createManual, setStatus, saveCategory } = useFinancialLedger();
  const initialRange = monthRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [showPaid, setShowPaid] = useState(true);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payEntry, setPayEntry] = useState<FinancialEntry | null>(null);
  const [payDate, setPayDate] = useState(todayIsoDate());

  const title = direction === 'receber' ? 'Contas a receber' : 'Contas a pagar';
  const paidLabel = direction === 'receber' ? 'Recebidas' : 'Pagas';
  const today = todayIsoDate();

  const directionEntries = useMemo(
    () => entries.filter((entry) => entry.direction === direction),
    [entries, direction]
  );

  const cards = useMemo(() => {
    const sums = { overdue: 0, today: 0, upcoming: 0, paid: 0 };
    directionEntries.forEach((entry) => {
      sums[entryBucket(entry, today)] += Number(entry.amount) || 0;
    });
    return sums;
  }, [directionEntries, today]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return directionEntries.filter((entry) => {
      if (!entryInPeriod(entry, from, to)) return false;
      if (!showPaid && entry.status === 'paid') return false;
      if (categoryFilter !== 'all' && (entry.category || '') !== categoryFilter) return false;
      if (accountFilter !== 'all' && (entry.account || '') !== accountFilter) return false;
      if (!query) return true;
      const haystack = `${entry.description || ''} ${entry.contact_name || ''} ${entry.origin_label || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [directionEntries, from, to, showPaid, search, categoryFilter, accountFilter]);

  const totals = useMemo(() => {
    const query = search.trim().toLowerCase();
    const inRange = directionEntries.filter((entry) => {
      if (!entryInPeriod(entry, from, to)) return false;
      if (categoryFilter !== 'all' && (entry.category || '') !== categoryFilter) return false;
      if (accountFilter !== 'all' && (entry.account || '') !== accountFilter) return false;
      if (!query) return true;
      const haystack = `${entry.description || ''} ${entry.contact_name || ''}`.toLowerCase();
      return haystack.includes(query);
    });
    return inRange.reduce(
      (acc, entry) => {
        const amount = Number(entry.amount) || 0;
        if (entry.status === 'paid') acc.settled += amount;
        else if (entry.settlement_status === 'previsto') acc.forecast += amount;
        else acc.open += amount;
        return acc;
      },
      { open: 0, forecast: 0, settled: 0 }
    );
  }, [directionEntries, from, to, search, categoryFilter, accountFilter]);

  const categoryOptions = categories.filter(
    (category) => category.direction === direction || category.direction === 'ambos'
  );

  const runAction = async (action: () => Promise<void>, success: string) => {
    try {
      setSaving(true);
      await action();
      toast({ title: title, description: success });
      return true;
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível concluir',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout activeView="finance" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <FinanceSubnav />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-600">{title}</h1>
          <div className="flex gap-2">
            <Button
              type="button"
              className="bg-amber-400 text-slate-900 hover:bg-amber-500"
              onClick={() => exportFinanceCsv(`${direction}.csv`, filtered, direction)}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar (CSV)
            </Button>
            <Button
              type="button"
              className="bg-fuchsia-600 text-white hover:bg-fuchsia-700"
              onClick={() => exportFinancePdf(title, filtered, direction)}
            >
              Exportar (PDF)
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Atrasadas" value={cards.overdue} className={CARD_STYLES.overdue} />
          <SummaryCard label="Vence hoje" value={cards.today} className={CARD_STYLES.today} />
          <SummaryCard label="À vencer" value={cards.upcoming} className={CARD_STYLES.upcoming} />
          <SummaryCard label={paidLabel} value={cards.paid} className={CARD_STYLES.paid} />
        </div>

        <div className="mb-3 flex justify-end">
          <Button type="button" className="rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {direction === 'receber' ? 'Criar conta a receber' : 'Criar conta a pagar'}
          </Button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-white p-3">
          <span className="text-sm text-slate-500">Filtrar</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
          <span className="text-sm text-slate-400">a</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
          <div className="flex items-center gap-2 px-2">
            <Switch checked={showPaid} onCheckedChange={setShowPaid} id="show-paid" />
            <Label htmlFor="show-paid" className="text-sm text-slate-600">
              {paidLabel}
            </Label>
          </div>
          <Input
            placeholder="Descrição"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(searchDraft);
            }}
            className="min-w-[180px] flex-1"
          />
          <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => setSearch(searchDraft)}>
            <Search className="mr-2 h-4 w-4" />
            Pesquisar
          </Button>
          <Button type="button" onClick={() => setFiltersOpen(true)}>
            Filtros
          </Button>
        </div>

        <div className="mb-3 grid gap-4 rounded-md border bg-white p-3 text-sm md:grid-cols-3">
          <TotalLine
            label={direction === 'receber' ? 'Total a receber:' : 'Total a pagar:'}
            value={totals.open}
          />
          <TotalLine label="Total previsto" value={totals.forecast} />
          <TotalLine
            label={direction === 'receber' ? 'Total recebido:' : 'Total pago:'}
            value={totals.settled}
            highlight
          />
        </div>

        <div className="overflow-x-auto rounded-md border bg-white">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>Valor</TableHead>
                  <TableHead>Origem</TableHead>
                  {direction === 'receber' && <TableHead>Faturamento</TableHead>}
                  <TableHead>{direction === 'receber' ? 'Cliente' : 'Contato/Empresa'}</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data prevista</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={direction === 'receber' ? 11 : 10} className="py-8 text-center text-slate-400">
                      Nenhum lançamento no período
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    direction={direction}
                    disabled={saving}
                    onPay={() => {
                      setPayEntry(entry);
                      setPayDate(todayIsoDate());
                    }}
                    onCancel={() => void runAction(() => setStatus(entry.id, 'cancelled'), 'Lançamento cancelado')}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta</Label>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.name}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCategoryFilter('all'); setAccountFilter('all'); }}>
              Limpar
            </Button>
            <Button type="button" onClick={() => setFiltersOpen(false)}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FinanceEntryDialog
        open={createOpen}
        direction={direction}
        saving={saving}
        accounts={accounts}
        categories={categories}
        onOpenChange={setCreateOpen}
        onCreateCategory={async (name) => {
          await saveCategory({
            name,
            direction,
            dre_class: direction === 'receber' ? 'receita_vendas' : 'despesa_operacional',
          });
        }}
        onSubmit={async (draft) => {
          await runAction(async () => {
            await createManual({
              direction,
              amount: draft.amount,
              due_date: draft.due_date,
              competence_date: draft.competence_date,
              description: draft.description,
              contact_name: draft.contact_name,
              billing_name: draft.contact_name,
              category: draft.category,
              category_id: draft.category_id,
              account: draft.account,
              lead_id: draft.lead_id,
              payment_method: draft.payment_method,
              is_recurring: draft.is_recurring,
              realized: draft.realized,
              attachment_name: draft.attachment_name,
            });
            setCreateOpen(false);
          }, 'Lançamento criado');
        }}
      />
      <Dialog open={!!payEntry} onOpenChange={(open) => { if (!open) setPayEntry(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Data de pagamento</DialogTitle></DialogHeader>
          <div>
            <Label>Confirme a data em que o valor foi {direction === 'receber' ? 'recebido' : 'pago'}</Label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-2" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayEntry(null)}>Cancelar</Button>
            <Button type="button" disabled={saving || !payEntry} onClick={() => {
              if (!payEntry) return;
              void runAction(() => setStatus(payEntry.id, 'paid', paymentTimestamp(payDate)), 'Lançamento baixado').then((ok) => { if (ok) setPayEntry(null); });
            }}>Confirmar baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-md px-4 py-5 ${className}`}>
      <p className="text-sm font-medium opacity-90">{label}</p>
      <p className="mt-2 text-xl font-semibold">{formatFinanceMoney(value)}</p>
    </div>
  );
}

function TotalLine({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className={highlight ? 'font-semibold text-sky-600' : 'font-semibold text-slate-800'}>
        {formatFinanceMoney(value)}
      </p>
    </div>
  );
}

function EntryRow({
  entry,
  direction,
  disabled,
  onPay,
  onCancel,
}: {
  entry: FinancialEntry;
  direction: FinanceDirection;
  disabled: boolean;
  onPay: () => void;
  onCancel: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-medium">{formatFinanceMoney(Number(entry.amount))}</TableCell>
      <TableCell>{entry.origin_label || 'Normal'}</TableCell>
      {direction === 'receber' && <TableCell>{entry.billing_name || 'Sem contato'}</TableCell>}
      <TableCell>{entry.contact_name || '—'}</TableCell>
      <TableCell>
        <div>{entry.description || '—'}</div>
        {entry.payment_method ? (
          <div className="text-xs text-slate-500">
            {getPaymentMethodLabel(entry.payment_method as PaymentMethod)}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatFinanceDate(entry.due_date)}</TableCell>
      <TableCell className="whitespace-nowrap">{formatFinanceDate(entry.paid_at)}</TableCell>
      <TableCell className="whitespace-nowrap">{formatFinanceDate(entry.competence_date || entry.due_date)}</TableCell>
      <TableCell>{entry.category || '—'}</TableCell>
      <TableCell>{entry.account || '—'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">
            {entry.status === 'paid' ? (direction === 'receber' ? 'Recebido' : 'Pago') : 'Em aberto'}
          </span>
          {entry.status === 'open' && (
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-green-600" disabled={disabled} onClick={onPay} title={direction === 'receber' ? 'Receber' : 'Pagar'}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-600" disabled={disabled} onClick={onCancel} title="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

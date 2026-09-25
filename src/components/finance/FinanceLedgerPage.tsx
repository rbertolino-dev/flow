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
import { FinanceReceivablePanel } from '@/components/finance/FinanceReceivablePanel';
import { useFinancialLedger } from '@/hooks/useFinancialLedger';
import { getPaymentMethodLabel, PAYMENT_METHODS, type PaymentMethod } from "@/lib/paymentMethods";
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

interface LedgerFilters {
  status: string;
  category: string;
  account: string;
  clientKind: 'contato' | 'empresa';
  client: string;
  billingKind: 'contato' | 'empresa';
  billing: string;
  origin: string;
  paymentMethod: string;
  minAmount: string;
  maxAmount: string;
}

const EMPTY_FILTERS: LedgerFilters = {
  status: 'all',
  category: 'all',
  account: 'all',
  clientKind: 'contato',
  client: '',
  billingKind: 'contato',
  billing: '',
  origin: 'all',
  paymentMethod: 'all',
  minAmount: '0',
  maxAmount: '500.000',
};

function parseFilterAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(/\./g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function entryMatchesFilters(
  entry: FinancialEntry,
  filters: LedgerFilters,
  showPaidOnly: boolean,
  today: string
): boolean {
  if (filters.status === 'paid' || (filters.status === 'all' && showPaidOnly)) {
    if (entry.status !== 'paid') return false;
  } else if (filters.status === 'open') {
    if (entry.status !== 'open' || entry.settlement_status === 'previsto') return false;
  } else if (filters.status === 'previsto') {
    if (entry.settlement_status !== 'previsto' || entry.status === 'paid') return false;
  } else if (filters.status === 'atrasado') {
    if (entry.status === 'paid' || entry.due_date.slice(0, 10) >= today) return false;
  } else if (entry.status === 'paid') {
    return false;
  }

  if (filters.category !== 'all' && (entry.category || '') !== filters.category) return false;
  if (filters.account !== 'all' && (entry.account || '') !== filters.account) return false;
  if (filters.origin !== 'all' && (entry.origin_label || 'Normal') !== filters.origin) return false;
  if (filters.paymentMethod !== 'all' && (entry.payment_method || '') !== filters.paymentMethod) return false;

  const client = filters.client.trim().toLowerCase();
  if (client) {
    const clientField = filters.clientKind === 'empresa' ? entry.billing_name : entry.contact_name;
    if (!(clientField || '').toLowerCase().includes(client)) return false;
  }
  const billing = filters.billing.trim().toLowerCase();
  if (billing && !(entry.billing_name || '').toLowerCase().includes(billing)) return false;

  const amount = Number(entry.amount) || 0;
  const minAmount = parseFilterAmount(filters.minAmount);
  const maxAmount = parseFilterAmount(filters.maxAmount);
  if (minAmount != null && amount < minAmount) return false;
  if (maxAmount != null && amount > maxAmount) return false;
  return true;
}

const CARD_STYLES = {
  overdue: 'bg-red-500 text-white',
  today: 'bg-orange-500 text-white',
  upcoming: 'bg-yellow-400 text-slate-900',
  paid: 'bg-green-600 text-white',
} as const;

export function FinanceLedgerPage({ direction }: FinanceLedgerPageProps) {
  const { toast } = useToast();
  const { entries, accounts, categories, loading, createManual, updateEntry, setStatus, saveCategory } = useFinancialLedger();
  const initialRange = monthRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [showPaid, setShowPaid] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<LedgerFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<LedgerFilters | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payEntry, setPayEntry] = useState<FinancialEntry | null>(null);
  const [payDate, setPayDate] = useState(todayIsoDate());
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const originOptions = useMemo(() => {
    const names = new Set(directionEntries.map((entry) => entry.origin_label || 'Normal'));
    return [...names].sort();
  }, [directionEntries]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return directionEntries.filter((entry) => {
      if (!entryInPeriod(entry, from, to)) return false;
      if (appliedFilters && !entryMatchesFilters(entry, appliedFilters, showPaid, today)) return false;
      if (!appliedFilters) {
        if (showPaid && entry.status !== 'paid') return false;
        if (!showPaid && entry.status === 'paid') return false;
      }
      if (!query) return true;
      const haystack = `${entry.description || ''} ${entry.contact_name || ''} ${entry.origin_label || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [directionEntries, from, to, showPaid, search, appliedFilters, today]);

  const totals = useMemo(() => {
    const query = search.trim().toLowerCase();
    const inRange = directionEntries.filter((entry) => {
      if (!entryInPeriod(entry, from, to)) return false;
      if (appliedFilters && !entryMatchesFilters(entry, appliedFilters, showPaid, today)) return false;
      if (!appliedFilters) {
        if (showPaid && entry.status !== 'paid') return false;
        if (!showPaid && entry.status === 'paid') return false;
      }
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
  }, [directionEntries, from, to, search, appliedFilters, showPaid, today]);

  const selectedEntry = directionEntries.find((entry) => entry.id === selectedId) || null;

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
                    onOpen={() => setSelectedId(entry.id)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto [&>button]:text-red-600">
          <DialogHeader>
            <DialogTitle className="text-2xl">Filtros</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status:</Label>
              <Select value={filterDraft.status} onValueChange={(value) => setFilterDraft({ ...filterDraft, status: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Selecione</SelectItem>
                  <SelectItem value="open">Em aberto</SelectItem>
                  <SelectItem value="paid">{direction === 'receber' ? 'Recebido' : 'Pago'}</SelectItem>
                  <SelectItem value="previsto">Previsto</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categorias:</Label>
              <Select value={filterDraft.category} onValueChange={(value) => setFilterDraft({ ...filterDraft, category: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Selecione</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contas:</Label>
              <Select value={filterDraft.account} onValueChange={(value) => setFilterDraft({ ...filterDraft, account: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Selecione</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.name}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente:</Label>
              <div className="flex gap-2">
                <Select value={filterDraft.clientKind} onValueChange={(value: 'contato' | 'empresa') => setFilterDraft({ ...filterDraft, clientKind: value })}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contato">Contato</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Contato"
                  value={filterDraft.client}
                  onChange={(event) => setFilterDraft({ ...filterDraft, client: event.target.value })}
                />
              </div>
            </div>
            {direction === 'receber' && (
              <div>
                <Label>Faturamento:</Label>
                <div className="flex gap-2">
                  <Select value={filterDraft.billingKind} onValueChange={(value: 'contato' | 'empresa') => setFilterDraft({ ...filterDraft, billingKind: value })}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contato">Contato</SelectItem>
                      <SelectItem value="empresa">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Contato"
                    value={filterDraft.billing}
                    onChange={(event) => setFilterDraft({ ...filterDraft, billing: event.target.value })}
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Origem</Label>
              <Select value={filterDraft.origin} onValueChange={(value) => setFilterDraft({ ...filterDraft, origin: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Selecione</SelectItem>
                  {originOptions.map((origin) => (
                    <SelectItem key={origin} value={origin}>{origin}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={filterDraft.paymentMethod} onValueChange={(value) => setFilterDraft({ ...filterDraft, paymentMethod: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Selecione</SelectItem>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-sm text-slate-600">Acima de</p>
                  <Input
                    value={filterDraft.minAmount}
                    onChange={(event) => setFilterDraft({ ...filterDraft, minAmount: event.target.value })}
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm text-slate-600">Abaixo de</p>
                  <Input
                    value={filterDraft.maxAmount}
                    onChange={(event) => setFilterDraft({ ...filterDraft, maxAmount: event.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              className="bg-slate-500 text-white hover:bg-slate-600"
              onClick={() => {
                setFilterDraft(EMPTY_FILTERS);
                setAppliedFilters(null);
                setFiltersOpen(false);
              }}
            >
              Limpar filtros
            </Button>
            <Button
              type="button"
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                setAppliedFilters({ ...filterDraft });
                setFiltersOpen(false);
              }}
            >
              Filtrar
            </Button>
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
      <FinanceReceivablePanel
        entry={selectedEntry}
        direction={direction}
        accounts={accounts}
        categories={categories}
        saving={saving}
        onClose={() => setSelectedId(null)}
        onSave={async (entryId, patch) => {
          await runAction(() => updateEntry(entryId, patch), 'Lançamento atualizado');
        }}
        onReceive={async (entry) => {
          await runAction(
            () => setStatus(entry.id, 'paid', paymentTimestamp(todayIsoDate())),
            direction === 'receber' ? 'Lançamento recebido' : 'Lançamento pago'
          );
        }}
        onDelete={async (entry) => {
          const ok = await runAction(() => setStatus(entry.id, 'cancelled'), 'Lançamento excluído');
          if (ok) setSelectedId(null);
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
  onOpen,
  onPay,
  onCancel,
}: {
  entry: FinancialEntry;
  direction: FinanceDirection;
  disabled: boolean;
  onOpen?: () => void;
  onPay: () => void;
  onCancel: () => void;
}) {
  return (
    <TableRow
      className={onOpen ? 'cursor-pointer hover:bg-slate-50' : undefined}
      onClick={onOpen}
    >
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
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-green-600" disabled={disabled} onClick={(event) => { event.stopPropagation(); onPay(); }} title={direction === 'receber' ? 'Receber' : 'Pagar'}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-600" disabled={disabled} onClick={(event) => { event.stopPropagation(); onCancel(); }} title="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

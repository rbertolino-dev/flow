import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, CreditCard, Landmark, Loader2, Upload } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { FinanceSubnav } from '@/components/finance/FinanceSubnav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useBankReconciliation, type BankReconciliationLine, type LineDraft } from '@/hooks/useBankReconciliation';
import { useFinancialLedger } from '@/hooks/useFinancialLedger';
import { useToast } from '@/hooks/use-toast';
import { formatFinanceMoney, type FinancialAccount, type FinancialEntry } from '@/lib/finance';
import { OFX_MAX_TRANSACTIONS } from '@/lib/ofxParser';
import { cn } from '@/lib/utils';

interface LeadOption {
  id: string;
  name: string;
  phone?: string | null;
  company?: string | null;
}

export default function FinanceReconciliation() {
  const { toast } = useToast();
  const { accounts, categories, loading: ledgerLoading } = useFinancialLedger();
  const {
    reconciliation,
    lines,
    loading,
    workingLineId,
    importOfx,
    postLine,
    linkLine,
    searchCandidates,
    suggestMatch,
    resetSession,
  } = useBankReconciliation();
  const [accountId, setAccountId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) || null,
    [accounts, accountId],
  );

  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const onUpload = async (file: File | null) => {
    if (!file || !selectedAccount) {
      toast({ title: 'Conciliação', description: 'Selecione a conta antes do upload', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      await importOfx(file, selectedAccount);
    } catch (error) {
      toast({
        title: 'Conciliação',
        description: error instanceof Error ? error.message : 'Não foi possível importar o OFX',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <CRMLayout activeView="finance" onViewChange={() => {}}>
      <div className="mx-auto max-w-[1100px] p-4 md:p-6">
        <FinanceSubnav />
        <div className="mb-6 flex items-center gap-2 text-slate-700">
          <Landmark className="h-6 w-6" aria-hidden />
          <h1 className="text-2xl font-semibold">Conciliação Bancária</h1>
        </div>

        <section className="mb-8">
          <p className="mb-3 text-sm font-medium text-slate-600">1º Passo - Informe o tipo de conciliação a ser realizada</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="flex items-center justify-center gap-3 rounded-md bg-slate-800 px-4 py-6 text-white shadow"
            >
              <CheckSquare className="h-6 w-6" />
              <span className="font-semibold">Conciliação Normal</span>
            </button>
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed items-center justify-center gap-3 rounded-md bg-slate-200 px-4 py-6 text-slate-500"
              title="Em breve"
            >
              <CreditCard className="h-6 w-6" />
              <span className="font-semibold">Conciliação de Fatura com Pagamento</span>
            </button>
          </div>
        </section>

        <section className="mb-8">
          <p className="mb-3 text-sm font-medium text-slate-600">2º Passo - Selecione o banco que deseja fazer a conciliação</p>
          {ledgerLoading ? (
            <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando contas</div>
          ) : accounts.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="mb-3">Nenhuma conta encontrada na carteira desta empresa. Cadastre em Bancos para poder conciliar.</p>
              <Button asChild className="bg-slate-800 hover:bg-slate-900">
                <Link to="/financeiro/bancos">Ir para Bancos</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-w-md">
                <Label className="mb-1 block">Conta / banco</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                {accounts.map((account) => (
                  <AccountChip
                    key={account.id}
                    account={account}
                    active={account.id === accountId}
                    onSelect={() => setAccountId(account.id)}
                  />
                ))}
              </div>
              {selectedAccount && (
                <p className="text-sm text-slate-600">
                  Conta selecionada: <strong>{accountLabel(selectedAccount)}</strong>
                </p>
              )}
            </div>
          )}
        </section>

        <section className="mb-8">
          <p className="mb-1 text-sm font-medium text-slate-600">3º Passo - Faça o upload do seu extrato bancário em formato OFX</p>
          <p className="mb-3 text-sm text-slate-500">
            O limite é de até {OFX_MAX_TRANSACTIONS} lançamentos. caso tenha um número maior exporte o OFX em período menor e tente novamente.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".ofx,.OFX,.qfx"
            className="hidden"
            onChange={(event) => void onUpload(event.target.files?.[0] || null)}
          />
          <Button
            type="button"
            className="bg-slate-200 text-slate-700 hover:bg-slate-300"
            disabled={!selectedAccount || importing || loading}
            onClick={() => fileRef.current?.click()}
          >
            {(importing || loading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            UPLOAD
          </Button>
          {reconciliation && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>Arquivo: <strong>{reconciliation.file_name}</strong></span>
              <span>Conta: <strong>{reconciliation.account_name}</strong></span>
              <Button type="button" variant="outline" size="sm" onClick={resetSession}>Nova importação</Button>
            </div>
          )}
        </section>

        <section>
          <p className="mb-3 text-sm font-medium text-slate-600">
            4º Passo - Verifique as movimentações bancárias. faça as mudanças quando necessário e clique em Lançar em cada uma.
          </p>
          {!reconciliation && (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-400">
              Importe um OFX para ver as movimentações aqui.
            </p>
          )}
          <div className="space-y-4">
            {lines.map((line) => (
              <ReconciliationCard
                key={line.id}
                line={line}
                accountName={reconciliation?.account_name || selectedAccount?.name || ''}
                categories={categories}
                busy={workingLineId === line.id}
                onPost={postLine}
                onLink={linkLine}
                searchCandidates={searchCandidates}
                suggestMatch={suggestMatch}
              />
            ))}
          </div>
        </section>
      </div>
    </CRMLayout>
  );
}

function accountLabel(account: FinancialAccount): string {
  const parts = [account.name, account.bank_name, account.account_type].filter(Boolean);
  return parts.join(' · ');
}

function AccountChip({ account, active, onSelect }: { account: FinancialAccount; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'min-w-[140px] rounded-md border px-4 py-3 text-left text-sm transition-colors',
        active ? 'border-slate-800 bg-slate-800 text-white shadow' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      <p className="font-semibold">{account.name}</p>
      <p className={cn('text-xs', active ? 'text-slate-200' : 'text-slate-500')}>
        {[account.bank_name, account.account_type].filter(Boolean).join(' · ') || 'Conta da carteira'}
      </p>
    </button>
  );
}

function ReconciliationCard({
  line,
  accountName,
  categories,
  busy,
  onPost,
  onLink,
  searchCandidates,
  suggestMatch,
}: {
  line: BankReconciliationLine;
  accountName: string;
  categories: Array<{ id: string; name: string; direction: string }>;
  busy: boolean;
  onPost: (line: BankReconciliationLine, draft: LineDraft, accountName: string) => Promise<void>;
  onLink: (line: BankReconciliationLine, entry: FinancialEntry, accountName: string) => Promise<void>;
  searchCandidates: (line: BankReconciliationLine, query?: string) => Promise<FinancialEntry[]>;
  suggestMatch: (line: BankReconciliationLine) => Promise<FinancialEntry | null>;
}) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const locked = line.status === 'posted' || line.status === 'linked';
  const categoryOptions = categories.filter((category) => category.direction === line.direction || category.direction === 'ambos');
  const [draft, setDraft] = useState<LineDraft>({
    description: line.description || '',
    posted_at: line.posted_at,
    category_id: line.category_id || categoryOptions[0]?.id || '',
    category: line.category || categoryOptions[0]?.name || '',
    contact_name: line.contact_name || '',
    lead_id: line.lead_id,
  });
  const [leadQuery, setLeadQuery] = useState('');
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [candidates, setCandidates] = useState<FinancialEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [suggestion, setSuggestion] = useState<FinancialEntry | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (locked) return;
    void suggestMatch(line).then(setSuggestion).catch(() => setSuggestion(null));
  }, [line, locked, suggestMatch]);

  useEffect(() => {
    if (!activeOrgId || leadQuery.trim().length < 2) {
      setLeadOptions([]);
      return;
    }
    const query = leadQuery.trim().replace(/[%(),]/g, ' ');
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, name, phone, company')
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .ilike('name', `%${query}%`)
        .limit(8);
      setLeadOptions((data || []) as LeadOption[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [leadQuery, activeOrgId]);

  const runSearch = async () => {
    setSearching(true);
    try {
      const rows = await searchCandidates(line, linkQuery);
      setCandidates(rows);
      if (rows[0]) setSelectedEntryId(rows[0].id);
    } catch (error) {
      toast({
        title: 'Conciliação',
        description: error instanceof Error ? error.message : 'Falha ao buscar lançamentos',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const bankLabel = line.memo || line.payee_name || line.trn_type || 'Movimentação';
  const isOut = line.direction === 'pagar';

  return (
    <div className={cn('overflow-hidden rounded-md border bg-white shadow-sm', isOut ? 'border-t-4 border-t-red-500' : 'border-t-4 border-t-green-500')}>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div>
          <div className="mb-2 inline-flex rounded border bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
            {isOut ? 'Saída' : 'Entrada'}
          </div>
          <p className="text-sm text-slate-700">{bankLabel}</p>
          <p className={cn('mt-2 text-2xl font-bold', isOut ? 'text-red-600' : 'text-green-600')}>
            {formatFinanceMoney(line.amount)}
          </p>
          <p className="mt-3 text-xs text-slate-500">Data do lançamento: {line.fit_id}</p>
          <Input
            type="date"
            className="mt-2 max-w-[180px]"
            value={draft.posted_at}
            disabled={locked || busy}
            onChange={(event) => setDraft((prev) => ({ ...prev, posted_at: event.target.value }))}
          />
        </div>

        <div className="space-y-3">
          {locked ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {line.status === 'posted' ? 'Lançado' : 'Vinculado'} com sucesso.
            </p>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Nome do lançamento</label>
                <Input
                  value={draft.description}
                  disabled={busy}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Buscar contato</label>
                <Input
                  placeholder="Buscar contato"
                  value={leadQuery || draft.contact_name}
                  disabled={busy}
                  onChange={(event) => {
                    setLeadQuery(event.target.value);
                    setDraft((prev) => ({ ...prev, contact_name: event.target.value, lead_id: null }));
                  }}
                />
                {leadOptions.length > 0 && (
                  <div className="mt-1 max-h-36 overflow-auto rounded border bg-white text-sm">
                    {leadOptions.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setDraft((prev) => ({ ...prev, lead_id: lead.id, contact_name: lead.name }));
                          setLeadQuery(lead.name);
                          setLeadOptions([]);
                        }}
                      >
                        {lead.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Categoria</label>
                <Select
                  value={draft.category_id}
                  disabled={busy}
                  onValueChange={(value) => {
                    const category = categoryOptions.find((item) => item.id === value);
                    setDraft((prev) => ({
                      ...prev,
                      category_id: value,
                      category: category?.name || '',
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {suggestion && !linkOpen && (
                <p className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                  Sugestão: {suggestion.description || suggestion.contact_name || 'Lançamento'} · {formatFinanceMoney(suggestion.amount)}
                </p>
              )}

              {linkOpen && (
                <div className="space-y-2 rounded-md border bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-700">Buscar lançamento existente:</p>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="Pesquisar"
                      value={linkQuery}
                      onChange={(event) => setLinkQuery(event.target.value)}
                      className="bg-white"
                    />
                    <Button type="button" className="bg-green-600 hover:bg-green-700" disabled={searching} onClick={() => void runSearch()}>
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pesquisar'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Buscando lançamentos em {line.posted_at.slice(5, 7)}/{line.posted_at.slice(0, 4)}
                  </p>
                  {candidates.length > 0 && (
                    <Select value={selectedEntryId} onValueChange={setSelectedEntryId}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {candidates.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {(entry.description || entry.contact_name || 'Lançamento')} · {formatFinanceMoney(entry.amount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    const next = !linkOpen;
                    setLinkOpen(next);
                    if (next) void runSearch();
                  }}
                >
                  Vincular a Lançamento Existente
                </Button>
                {linkOpen ? (
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={busy || !selectedEntryId}
                    onClick={() => {
                      const entry = candidates.find((item) => item.id === selectedEntryId) || suggestion;
                      if (!entry) return;
                      void onLink(line, entry, accountName).catch((error) => {
                        toast({
                          title: 'Erro',
                          description: error instanceof Error ? error.message : 'Falha ao vincular',
                          variant: 'destructive',
                        });
                      });
                    }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar vínculo'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={busy || !draft.category_id}
                    onClick={() => {
                      void onPost(line, draft, accountName).catch((error) => {
                        toast({
                          title: 'Erro',
                          description: error instanceof Error ? error.message : 'Falha ao lançar',
                          variant: 'destructive',
                        });
                      });
                    }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lançar'}
                  </Button>
                )}
                {suggestion && !linkOpen && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void onLink(line, suggestion, accountName).catch((error) => {
                        toast({
                          title: 'Erro',
                          description: error instanceof Error ? error.message : 'Falha ao vincular',
                          variant: 'destructive',
                        });
                      });
                    }}
                  >
                    Usar sugestão
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';
import { paymentTimestamp, type FinanceDirection, type FinancialAccount, type FinancialEntry } from '@/lib/finance';
import { defaultOfxDescription, hashFile, parseOfxFile, type OfxTransaction } from '@/lib/ofxParser';

interface DbResult {
  data: unknown;
  error: { message: string } | null;
}

interface DbQuery extends Promise<DbResult> {
  select(columns: string): DbQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): DbQuery;
  update(values: Record<string, unknown>): DbQuery;
  eq(column: string, value: string): DbQuery;
  neq(column: string, value: string): DbQuery;
  in(column: string, values: string[]): DbQuery;
  gte(column: string, value: string): DbQuery;
  lte(column: string, value: string): DbQuery;
  is(column: string, value: null): DbQuery;
  or(filters: string): DbQuery;
  ilike(column: string, value: string): DbQuery;
  order(column: string, options?: { ascending: boolean }): DbQuery;
  limit(count: number): DbQuery;
  maybeSingle(): Promise<DbResult>;
}

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => DbQuery;
};

function db(): RpcClient {
  return supabase as unknown as RpcClient;
}

export type ReconciliationLineStatus = 'pending' | 'posted' | 'linked' | 'skipped';

export interface BankReconciliation {
  id: string;
  organization_id: string;
  account_id: string | null;
  account_name: string;
  file_name: string;
  file_hash: string | null;
  period_start: string | null;
  period_end: string | null;
  status: 'open' | 'done';
  created_at: string;
}

export interface BankReconciliationLine {
  id: string;
  reconciliation_id: string;
  organization_id: string;
  fit_id: string;
  trn_type: string | null;
  posted_at: string;
  amount: number;
  direction: FinanceDirection;
  memo: string | null;
  payee_name: string | null;
  status: ReconciliationLineStatus;
  entry_id: string | null;
  description: string | null;
  category_id: string | null;
  category: string | null;
  contact_name: string | null;
  lead_id: string | null;
}

export interface LineDraft {
  description: string;
  posted_at: string;
  category_id: string;
  category: string;
  contact_name: string;
  lead_id: string | null;
}

function asLine(row: Record<string, unknown>): BankReconciliationLine {
  return {
    id: String(row.id || ''),
    reconciliation_id: String(row.reconciliation_id || ''),
    organization_id: String(row.organization_id || ''),
    fit_id: String(row.fit_id || ''),
    trn_type: row.trn_type ? String(row.trn_type) : null,
    posted_at: String(row.posted_at || '').slice(0, 10),
    amount: Number(row.amount) || 0,
    direction: row.direction === 'pagar' ? 'pagar' : 'receber',
    memo: row.memo ? String(row.memo) : null,
    payee_name: row.payee_name ? String(row.payee_name) : null,
    status: (row.status as ReconciliationLineStatus) || 'pending',
    entry_id: row.entry_id ? String(row.entry_id) : null,
    description: row.description ? String(row.description) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    category: row.category ? String(row.category) : null,
    contact_name: row.contact_name ? String(row.contact_name) : null,
    lead_id: row.lead_id ? String(row.lead_id) : null,
  };
}

function monthBounds(isoDate: string): { from: string; to: string } {
  const [year, month] = isoDate.slice(0, 7).split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(year, month, 0);
  const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return { from, to };
}

function shiftDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useBankReconciliation() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [reconciliation, setReconciliation] = useState<BankReconciliation | null>(null);
  const [lines, setLines] = useState<BankReconciliationLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingLineId, setWorkingLineId] = useState<string | null>(null);

  const importOfx = useCallback(async (file: File, account: FinancialAccount) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    setLoading(true);
    try {
      const parsed = await parseOfxFile(file);
      const fileHash = await hashFile(file);
      const fitIds = parsed.transactions.map((tx) => tx.fitId);
      const existing = await db()
        .from('bank_reconciliation_lines')
        .select('fit_id')
        .eq('organization_id', activeOrgId)
        .in('fit_id', fitIds);
      if (existing.error) throw new Error(existing.error.message);
      const known = new Set(((existing.data || []) as Array<{ fit_id: string }>).map((row) => row.fit_id));
      const fresh = parsed.transactions.filter((tx) => !known.has(tx.fitId));
      if (fresh.length === 0) {
        throw new Error('Todos os lançamentos deste OFX já foram importados nesta organização');
      }

      const { data: userData } = await supabase.auth.getUser();
      const created = await db()
        .from('bank_reconciliations')
        .insert({
          organization_id: activeOrgId,
          account_id: account.id,
          account_name: account.name,
          file_name: file.name,
          file_hash: fileHash,
          period_start: parsed.periodStart,
          period_end: parsed.periodEnd,
          status: 'open',
          created_by: userData.user?.id || null,
        })
        .select('id, organization_id, account_id, account_name, file_name, file_hash, period_start, period_end, status, created_at')
        .maybeSingle();
      if (created.error) throw new Error(created.error.message);
      const recon = created.data as BankReconciliation;
      if (!recon?.id) throw new Error('Não foi possível criar a conciliação');

      const payload = fresh.map((tx: OfxTransaction) => ({
        reconciliation_id: recon.id,
        organization_id: activeOrgId,
        fit_id: tx.fitId,
        trn_type: tx.trnType,
        posted_at: tx.postedAt,
        amount: tx.amount,
        direction: tx.direction,
        memo: tx.memo || null,
        payee_name: tx.payeeName || null,
        status: 'pending',
        description: defaultOfxDescription(tx),
      }));

      const inserted = await db()
        .from('bank_reconciliation_lines')
        .insert(payload)
        .select('*')
        .order('posted_at', { ascending: true });
      if (inserted.error) throw new Error(inserted.error.message);

      setReconciliation(recon);
      setLines(((inserted.data || []) as Record<string, unknown>[]).map(asLine));
      const skipped = parsed.transactions.length - fresh.length;
      toast({
        title: 'Conciliação',
        description: skipped > 0
          ? `${fresh.length} lançamentos importados (${skipped} já existiam e foram ignorados)`
          : `${fresh.length} lançamentos importados`,
      });
      return recon;
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  const updateLineLocal = (lineId: string, patch: Partial<BankReconciliationLine>) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const postLine = useCallback(async (line: BankReconciliationLine, draft: LineDraft, accountName: string) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    if (!draft.category_id && !draft.category.trim()) throw new Error('Selecione a categoria');
    setWorkingLineId(line.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const created = await db().rpc('upsert_financial_entry', {
        p_organization_id: activeOrgId,
        p_direction: line.direction,
        p_amount: line.amount,
        p_due_date: draft.posted_at,
        p_source_type: 'ofx',
        p_source_id: line.fit_id,
        p_status: 'paid',
        p_settlement_status: 'confirmado',
        p_lead_id: draft.lead_id || null,
        p_description: draft.description.trim() || line.memo || 'Lançamento OFX',
        p_contact_name: draft.contact_name.trim() || null,
        p_billing_name: draft.contact_name.trim() || 'Sem contato',
        p_category: draft.category || null,
        p_account: accountName,
        p_origin_label: 'OFX',
        p_paid_at: paymentTimestamp(draft.posted_at),
        p_competence_date: draft.posted_at,
        p_category_id: draft.category_id || null,
        p_created_by: userData.user?.id || null,
      });
      if (created.error) throw new Error(created.error.message);
      const entryId = typeof created.data === 'string' ? created.data : null;
      if (!entryId) throw new Error('Não foi possível criar o lançamento');

      await db()
        .from('financial_entries')
        .update({
          bank_fit_id: line.fit_id,
          reconciliation_line_id: line.id,
        })
        .eq('id', entryId)
        .eq('organization_id', activeOrgId);

      const updated = await db()
        .from('bank_reconciliation_lines')
        .update({
          status: 'posted',
          entry_id: entryId,
          description: draft.description.trim() || line.description,
          posted_at: draft.posted_at,
          category_id: draft.category_id || null,
          category: draft.category || null,
          contact_name: draft.contact_name.trim() || null,
          lead_id: draft.lead_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', line.id)
        .eq('organization_id', activeOrgId)
        .select('*')
        .maybeSingle();
      if (updated.error) throw new Error(updated.error.message);
      if (updated.data) updateLineLocal(line.id, asLine(updated.data as Record<string, unknown>));
      toast({ title: 'Conciliação', description: 'Lançamento criado e conciliado' });
    } finally {
      setWorkingLineId(null);
    }
  }, [activeOrgId, toast]);

  const searchCandidates = useCallback(async (
    line: BankReconciliationLine,
    query?: string,
  ): Promise<FinancialEntry[]> => {
    if (!activeOrgId) return [];
    const { from, to } = monthBounds(line.posted_at);
    const result = await db()
      .from('financial_entries')
      .select('id, organization_id, direction, amount, due_date, competence_date, paid_at, status, settlement_status, source_type, source_id, lead_id, budget_id, description, contact_name, billing_name, category, category_id, account, origin_label, bank_fit_id, created_at')
      .eq('organization_id', activeOrgId)
      .eq('direction', line.direction)
      .neq('status', 'cancelled')
      .is('bank_fit_id', null)
      .gte('amount', line.amount - 0.01)
      .lte('amount', line.amount + 0.01)
      .or(`and(due_date.gte.${from},due_date.lte.${to}),and(paid_at.gte.${from}T00:00:00.000Z,paid_at.lte.${to}T23:59:59.999Z)`)
      .order('due_date', { ascending: false })
      .limit(40);
    if (result.error) throw new Error(result.error.message);
    const rows = ((result.data || []) as Array<FinancialEntry & { bank_fit_id?: string | null }>)
      .filter((entry) => !entry.bank_fit_id);
    const needle = (query || '').trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((entry) =>
      [entry.description, entry.contact_name, entry.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [activeOrgId]);

  const suggestMatch = useCallback(async (line: BankReconciliationLine): Promise<FinancialEntry | null> => {
    const candidates = await searchCandidates(line);
    const from = shiftDays(line.posted_at, -3);
    const to = shiftDays(line.posted_at, 3);
    const scored = candidates.find((entry) => {
      const due = (entry.due_date || '').slice(0, 10);
      const paid = (entry.paid_at || '').slice(0, 10);
      return (due >= from && due <= to) || (paid >= from && paid <= to);
    });
    return scored || null;
  }, [searchCandidates]);

  const linkLine = useCallback(async (line: BankReconciliationLine, entry: FinancialEntry, accountName: string) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    setWorkingLineId(line.id);
    try {
      if (entry.status === 'open') {
        const paid = await db().rpc('set_financial_entry_status', {
          p_organization_id: activeOrgId,
          p_entry_id: entry.id,
          p_status: 'paid',
          p_paid_at: paymentTimestamp(line.posted_at),
        });
        if (paid.error) throw new Error(paid.error.message);
      }

      const patch: Record<string, unknown> = {
        bank_fit_id: line.fit_id,
        reconciliation_line_id: line.id,
      };
      if (!entry.account) patch.account = accountName;
      const updatedEntry = await db()
        .from('financial_entries')
        .update(patch)
        .eq('id', entry.id)
        .eq('organization_id', activeOrgId);
      if (updatedEntry.error) throw new Error(updatedEntry.error.message);

      const updated = await db()
        .from('bank_reconciliation_lines')
        .update({
          status: 'linked',
          entry_id: entry.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', line.id)
        .eq('organization_id', activeOrgId)
        .select('*')
        .maybeSingle();
      if (updated.error) throw new Error(updated.error.message);
      if (updated.data) updateLineLocal(line.id, asLine(updated.data as Record<string, unknown>));
      toast({ title: 'Conciliação', description: 'Lançamento vinculado ao extrato' });
    } finally {
      setWorkingLineId(null);
    }
  }, [activeOrgId, toast]);

  const resetSession = () => {
    setReconciliation(null);
    setLines([]);
  };

  return {
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
  };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';
import {
  paymentTimestamp,
  todayIsoDate,
  type FinanceDirection,
  type FinancialAccount,
  type FinancialCategory,
  type FinancialEntry,
} from '@/lib/finance';

interface FinanceResult {
  data: unknown;
  error: { message: string } | null;
  count: number | null;
}

interface FinanceQuery extends Promise<FinanceResult> {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): FinanceQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): FinanceQuery;
  update(values: Record<string, unknown>): FinanceQuery;
  delete(): FinanceQuery;
  eq(column: string, value: string): FinanceQuery;
  neq(column: string, value: string): FinanceQuery;
  order(column: string, options?: { ascending: boolean }): FinanceQuery;
  limit(count: number): FinanceQuery;
}

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => FinanceQuery;
};

function db(): RpcClient {
  return supabase as unknown as RpcClient;
}

async function ensureFinanceDefaults(organizationId: string) {
  const { count, error } = await db()
    .from('financial_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (error || (count ?? 0) > 0) return;

  await db().from('financial_accounts').insert([
    { organization_id: organizationId, name: 'Caixa' },
    { organization_id: organizationId, name: 'Banco' },
    { organization_id: organizationId, name: 'PIX' },
  ]);

  await db().from('financial_categories').insert([
    { organization_id: organizationId, name: 'Vendas', direction: 'receber', dre_class: 'receita_vendas' },
    { organization_id: organizationId, name: 'Serviços', direction: 'receber', dre_class: 'receita_servicos' },
    { organization_id: organizationId, name: 'Outros', direction: 'ambos', dre_class: 'outras_receitas' },
    { organization_id: organizationId, name: 'Comissão', direction: 'pagar', dre_class: 'despesa_operacional' },
    { organization_id: organizationId, name: 'Fornecedores', direction: 'pagar', dre_class: 'custo' },
    { organization_id: organizationId, name: 'Despesas', direction: 'pagar', dre_class: 'despesa_operacional' },
  ]);
}

export function useFinancialLedger() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeOrgId) {
      setEntries([]);
      setAccounts([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await ensureFinanceDefaults(activeOrgId);

      const [entryRes, accountRes, categoryRes] = await Promise.all([
        db()
          .from('financial_entries')
          .select('*')
          .eq('organization_id', activeOrgId)
          .neq('status', 'cancelled')
          .order('due_date', { ascending: true })
          .limit(2000),
        db()
          .from('financial_accounts')
          .select('id, organization_id, name')
          .eq('organization_id', activeOrgId)
          .order('name'),
        db()
          .from('financial_categories')
          .select('id, organization_id, name, direction, dre_class')
          .eq('organization_id', activeOrgId)
          .order('name'),
      ]);

      if (entryRes.error) throw entryRes.error;
      if (accountRes.error) throw accountRes.error;
      if (categoryRes.error) throw categoryRes.error;

      setEntries((entryRes.data || []) as FinancialEntry[]);
      setAccounts((accountRes.data || []) as FinancialAccount[]);
      setCategories((categoryRes.data || []) as FinancialCategory[]);
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
      toast({
        title: 'Financeiro',
        description: error instanceof Error ? error.message : 'Não foi possível carregar os lançamentos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createManual = async (input: {
    direction: FinanceDirection;
    amount: number;
    due_date: string;
    competence_date: string;
    description: string;
    contact_name: string;
    billing_name?: string;
    category: string;
    category_id: string;
    account: string;
    lead_id: string;
    payment_method?: string;
    is_recurring?: boolean;
    realized?: boolean;
    attachment_name?: string;
  }) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    if (!input.lead_id) throw new Error('Vincule um contato do CRM');
    const realized = Boolean(input.realized);
    const { data, error } = await db().rpc('upsert_financial_entry', {
      p_organization_id: activeOrgId,
      p_direction: input.direction,
      p_amount: input.amount,
      p_due_date: input.due_date,
      p_source_type: 'manual',
      p_source_id: crypto.randomUUID(),
      p_status: realized ? 'paid' : 'open',
      p_settlement_status: 'confirmado',
      p_lead_id: input.lead_id,
      p_description: input.description,
      p_contact_name: input.contact_name,
      p_billing_name: input.contact_name || 'Sem contato',
      p_category: input.category || null,
      p_account: input.account || null,
      p_origin_label: 'Normal',
      p_paid_at: realized ? paymentTimestamp(todayIsoDate()) : null,
      p_competence_date: input.competence_date || input.due_date,
      p_category_id: input.category_id || null,
    });
    if (error) throw new Error(error.message);
    const entryId = typeof data === 'string' ? data : null;
    if (entryId) {
      const extra = await db()
        .from('financial_entries')
        .update({
          payment_method: input.payment_method || null,
          is_recurring: Boolean(input.is_recurring),
          attachment_name: input.attachment_name || null,
        })
        .eq('id', entryId)
        .eq('organization_id', activeOrgId);
      if (extra.error) throw new Error(extra.error.message);
    }
    await reload();
  };

  const setStatus = async (entryId: string, status: 'paid' | 'cancelled', paidAt?: string | null) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    const { error } = await db().rpc('set_financial_entry_status', {
      p_organization_id: activeOrgId,
      p_entry_id: entryId,
      p_status: status,
      p_paid_at: status === 'paid' ? paidAt || null : null,
    });
    if (error) throw new Error(error.message);
    await reload();
  };

  const saveCategory = async (input: {
    id?: string;
    name: string;
    direction: FinanceDirection | 'ambos';
    dre_class: string;
  }) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    const payload = { name: input.name.trim(), direction: input.direction, dre_class: input.dre_class };
    if (!payload.name) throw new Error('Informe o nome da categoria');
    if (input.id) {
      const updated = await db().from('financial_categories').update(payload).eq('id', input.id).eq('organization_id', activeOrgId);
      if (updated.error) throw new Error(updated.error.message);
      const renamed = await db().from('financial_entries').update({ category: payload.name }).eq('category_id', input.id).eq('organization_id', activeOrgId);
      if (renamed.error) throw new Error(renamed.error.message);
    } else {
      const created = await db().from('financial_categories').insert({ organization_id: activeOrgId, ...payload });
      if (created.error) throw new Error(created.error.message);
    }
    await reload();
  };

  const deleteCategory = async (categoryId: string) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    const openEntries = await db().from('financial_entries').select('id', { count: 'exact', head: true }).eq('organization_id', activeOrgId).eq('category_id', categoryId).eq('status', 'open');
    if (openEntries.error) throw new Error(openEntries.error.message);
    if ((openEntries.count ?? 0) > 0) throw new Error('Esta categoria ainda tem lançamentos em aberto');
    const removed = await db().from('financial_categories').delete().eq('id', categoryId).eq('organization_id', activeOrgId);
    if (removed.error) throw new Error(removed.error.message);
    await reload();
  };

  return { entries, accounts, categories, loading, reload, createManual, setStatus, saveCategory, deleteCategory, activeOrgId };
}

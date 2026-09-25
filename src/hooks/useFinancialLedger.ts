import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { useToast } from '@/hooks/use-toast';
import type {
  FinanceDirection,
  FinancialAccount,
  FinancialCategory,
  FinancialEntry,
} from '@/lib/finance';

interface FinanceQuery {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): FinanceQuery;
  insert(values: Record<string, unknown>[]): Promise<{ error: { message: string } | null }>;
  eq(column: string, value: string): FinanceQuery & Promise<{ data: unknown; error: { message: string } | null; count: number | null }>;
  neq(column: string, value: string): FinanceQuery;
  order(column: string, options: { ascending: boolean }): FinanceQuery;
  limit(count: number): Promise<{ data: unknown; error: { message: string } | null }>;
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
    { organization_id: organizationId, name: 'Vendas', direction: 'receber' },
    { organization_id: organizationId, name: 'Serviços', direction: 'receber' },
    { organization_id: organizationId, name: 'Outros', direction: 'ambos' },
    { organization_id: organizationId, name: 'Comissão', direction: 'pagar' },
    { organization_id: organizationId, name: 'Fornecedores', direction: 'pagar' },
    { organization_id: organizationId, name: 'Despesas', direction: 'pagar' },
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
          .select('id, organization_id, name, direction')
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
    description: string;
    contact_name: string;
    billing_name?: string;
    category: string;
    account: string;
  }) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    const { error } = await db().rpc('upsert_financial_entry', {
      p_organization_id: activeOrgId,
      p_direction: input.direction,
      p_amount: input.amount,
      p_due_date: input.due_date,
      p_source_type: 'manual',
      p_source_id: crypto.randomUUID(),
      p_status: 'open',
      p_settlement_status: 'confirmado',
      p_description: input.description,
      p_contact_name: input.contact_name,
      p_billing_name: input.billing_name || 'Sem contato',
      p_category: input.category || null,
      p_account: input.account || null,
      p_origin_label: 'Normal',
    });
    if (error) throw new Error(error.message);
    await reload();
  };

  const setStatus = async (entryId: string, status: 'paid' | 'cancelled') => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    const { error } = await db().rpc('set_financial_entry_status', {
      p_organization_id: activeOrgId,
      p_entry_id: entryId,
      p_status: status,
    });
    if (error) throw new Error(error.message);
    await reload();
  };

  return {
    entries,
    accounts,
    categories,
    loading,
    reload,
    createManual,
    setStatus,
    activeOrgId,
  };
}

import { supabase } from '@/integrations/supabase/client';

/** Usa o número informado ou gera o próximo. Recusa número já usado na organização. */
export async function resolveBudgetNumber(
  organizationId: string,
  requested?: string | null,
  ignoreBudgetId?: string
): Promise<string> {
  const custom = (requested || '').trim();
  if (!custom) {
    const { data, error } = await supabase.rpc(
      'generate_budget_number' as never,
      { org_id: organizationId } as never
    );
    if (error) throw error;
    if (!data) throw new Error('Não foi possível gerar o número do orçamento');
    return String(data);
  }

  let query = supabase
    .from('budgets')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('budget_number', custom);
  if (ignoreBudgetId) query = query.neq('id', ignoreBudgetId);
  const { data: existing, error } = await query.maybeSingle();
  if (error) throw error;
  if (existing) throw new Error('Já existe um orçamento com esse número');
  return custom;
}

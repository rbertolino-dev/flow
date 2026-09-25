-- Carteira: banco, tipo e 4 dígitos da conta usada no PDV, orçamento e lançamentos.

ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT,
  ADD COLUMN IF NOT EXISTS last_digits TEXT;

DROP FUNCTION IF EXISTS public.sync_budget_receivable(UUID, UUID, BOOLEAN, DATE);

CREATE OR REPLACE FUNCTION public.sync_budget_receivable(
  p_organization_id UUID,
  p_budget_id UUID,
  p_received BOOLEAN DEFAULT false,
  p_receive_date DATE DEFAULT NULL,
  p_account TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget RECORD;
  v_due DATE;
  v_contact TEXT;
  v_id UUID;
  v_paid_at TIMESTAMPTZ;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  SELECT id, organization_id, budget_number, lead_id, client_data, total,
         delivery_date, expires_at, approved, rejected
  INTO v_budget
  FROM public.budgets
  WHERE id = p_budget_id AND organization_id = p_organization_id;

  IF v_budget.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE(v_budget.rejected, false) OR NOT COALESCE(v_budget.approved, false) THEN
    PERFORM public.cancel_financial_by_source(p_organization_id, 'orcamento', v_budget.id::text);
    RETURN NULL;
  END IF;

  v_contact := COALESCE(
    NULLIF(v_budget.client_data->>'name', ''),
    NULLIF(v_budget.client_data->>'company', ''),
    'Cliente'
  );
  v_due := COALESCE(
    p_receive_date,
    v_budget.delivery_date::date,
    v_budget.expires_at::date,
    CURRENT_DATE
  );
  v_paid_at := CASE
    WHEN COALESCE(p_received, false) THEN (v_due::text || 'T15:00:00Z')::timestamptz
    ELSE NULL
  END;

  v_id := public.upsert_financial_entry(
    p_organization_id => p_organization_id,
    p_direction => 'receber',
    p_amount => COALESCE(v_budget.total, 0),
    p_due_date => v_due,
    p_source_type => 'orcamento',
    p_source_id => v_budget.id::text,
    p_status => CASE WHEN COALESCE(p_received, false) THEN 'paid' ELSE 'open' END,
    p_settlement_status => 'confirmado',
    p_lead_id => v_budget.lead_id,
    p_budget_id => v_budget.id,
    p_description => 'Orçamento ' || COALESCE(v_budget.budget_number, ''),
    p_contact_name => v_contact,
    p_billing_name => 'Sem contato',
    p_category => 'Vendas',
    p_account => COALESCE(NULLIF(btrim(p_account), ''), 'Caixa'),
    p_origin_label => 'Orçamento',
    p_paid_at => v_paid_at,
    p_created_by => auth.uid(),
    p_competence_date => v_due
  );
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_budget_receivable(UUID, UUID, BOOLEAN, DATE, TEXT) TO authenticated, service_role;

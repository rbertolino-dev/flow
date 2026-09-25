-- Aprovação escolhe recebido ou data a receber.
-- Orçamento, PDV e OS não se cancelam só porque o cliente é o mesmo.

CREATE OR REPLACE FUNCTION public.cover_forecast_receivables(
  p_organization_id UUID,
  p_lead_id UUID DEFAULT NULL,
  p_budget_id UUID DEFAULT NULL,
  p_covered_by UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  IF p_budget_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.financial_entries
  SET status = 'cancelled',
      covered_by_entry_id = p_covered_by
  WHERE organization_id = p_organization_id
    AND direction = 'receber'
    AND status = 'open'
    AND settlement_status = 'previsto'
    AND budget_id = p_budget_id
    AND source_type = 'orcamento';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DROP FUNCTION IF EXISTS public.sync_budget_receivable(UUID, UUID);

CREATE OR REPLACE FUNCTION public.sync_budget_receivable(
  p_organization_id UUID,
  p_budget_id UUID,
  p_received BOOLEAN DEFAULT false,
  p_receive_date DATE DEFAULT NULL
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
    p_account => 'Caixa',
    p_origin_label => 'Orçamento',
    p_paid_at => v_paid_at,
    p_created_by => auth.uid(),
    p_competence_date => v_due
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_service_order_finance(
  p_organization_id UUID,
  p_order_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_contact TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  SELECT id, lead_id, client_name, total, has_commission, commission_value,
         collaborator_name, responsible_name, code, is_closed, deleted_at
  INTO v_order
  FROM public.service_orders
  WHERE id = p_order_id AND organization_id = p_organization_id;

  IF v_order.id IS NULL
     OR v_order.deleted_at IS NOT NULL
     OR NOT COALESCE(v_order.is_closed, false) THEN
    PERFORM public.cancel_financial_by_source(p_organization_id, 'ordem_servico', p_order_id::text);
    PERFORM public.cancel_financial_by_source(p_organization_id, 'comissao', 'os:' || p_order_id::text);
    RETURN NULL;
  END IF;

  v_contact := COALESCE(NULLIF(v_order.client_name, ''), 'Cliente');

  v_id := public.upsert_financial_entry(
    p_organization_id,
    'receber',
    COALESCE(v_order.total, 0),
    CURRENT_DATE,
    'ordem_servico',
    p_order_id::text,
    'open',
    'confirmado',
    v_order.lead_id,
    NULL,
    'OS ' || COALESCE(v_order.code, ''),
    v_contact,
    'Sem contato',
    'Serviços',
    'Caixa',
    'Ordem de serviço',
    NULL,
    auth.uid()
  );

  IF COALESCE(v_order.has_commission, false) AND COALESCE(v_order.commission_value, 0) > 0 THEN
    PERFORM public.upsert_financial_entry(
      p_organization_id,
      'pagar',
      v_order.commission_value,
      CURRENT_DATE,
      'comissao',
      'os:' || p_order_id::text,
      'open',
      'confirmado',
      v_order.lead_id,
      NULL,
      'Comissão OS ' || COALESCE(v_order.code, ''),
      COALESCE(NULLIF(v_order.collaborator_name, ''), NULLIF(v_order.responsible_name, ''), 'Vendedor'),
      'Sem contato',
      'Comissão',
      'Caixa',
      'Comissão',
      NULL,
      auth.uid()
    );
  ELSE
    PERFORM public.cancel_financial_by_source(p_organization_id, 'comissao', 'os:' || p_order_id::text);
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_budget_receivable(UUID, UUID, BOOLEAN, DATE) TO authenticated, service_role;

UPDATE public.financial_entries AS entry
SET status = 'open',
    settlement_status = 'confirmado',
    paid_at = NULL
FROM public.budgets AS budget
WHERE entry.organization_id = budget.organization_id
  AND entry.source_type = 'orcamento'
  AND entry.source_id = budget.id::text
  AND COALESCE(budget.approved, false)
  AND NOT COALESCE(budget.rejected, false)
  AND entry.status = 'cancelled'
  AND entry.settlement_status = 'previsto';

UPDATE public.financial_entries AS entry
SET settlement_status = 'confirmado'
FROM public.budgets AS budget
WHERE entry.organization_id = budget.organization_id
  AND entry.source_type = 'orcamento'
  AND entry.source_id = budget.id::text
  AND COALESCE(budget.approved, false)
  AND NOT COALESCE(budget.rejected, false)
  AND entry.status = 'open'
  AND entry.settlement_status = 'previsto';

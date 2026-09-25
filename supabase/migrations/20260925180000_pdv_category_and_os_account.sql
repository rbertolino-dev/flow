-- Categoria do PDV passa a gravar o nome do plano de contas.
-- Fechamento da OS escolhe a conta da carteira.

UPDATE public.financial_entries
SET category = CASE lower(btrim(category))
  WHEN 'vendas' THEN 'Vendas'
  WHEN 'servicos' THEN 'Serviços'
  WHEN 'outros' THEN 'Outros'
  ELSE category
END
WHERE source_type = 'pdv'
  AND lower(btrim(category)) IN ('vendas', 'servicos', 'outros');

UPDATE public.financial_entries AS entry
SET category_id = category.id
FROM public.financial_categories AS category
WHERE entry.category_id IS NULL
  AND entry.source_type = 'pdv'
  AND entry.organization_id = category.organization_id
  AND entry.category = category.name
  AND category.direction IN (entry.direction, 'ambos');

DROP FUNCTION IF EXISTS public.sync_service_order_finance(UUID, UUID);

CREATE OR REPLACE FUNCTION public.sync_service_order_finance(
  p_organization_id UUID,
  p_order_id UUID,
  p_account TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_contact TEXT;
  v_account TEXT;
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
  v_account := COALESCE(NULLIF(btrim(p_account), ''), 'Caixa');

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
    v_account,
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
      v_account,
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

GRANT EXECUTE ON FUNCTION public.sync_service_order_finance(UUID, UUID, TEXT) TO authenticated, service_role;

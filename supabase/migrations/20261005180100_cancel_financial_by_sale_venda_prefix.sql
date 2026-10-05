-- O estorno do PDV gravava source_id como venda:{sale_id}:{indice}.
-- A função antiga só casava o UUID puro e por isso não cancelava o lançamento.

CREATE OR REPLACE FUNCTION public.cancel_financial_by_sale(
  p_organization_id UUID,
  p_sale_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  IF p_sale_id IS NULL OR btrim(p_sale_id) = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.financial_entries
  SET status = 'cancelled'
  WHERE organization_id = p_organization_id
    AND status <> 'cancelled'
    AND (
      (
        source_type = 'pdv'
        AND (
          source_id = p_sale_id
          OR source_id LIKE p_sale_id || ':%'
          OR source_id LIKE 'venda:' || p_sale_id || ':%'
          OR source_id = 'pdv:' || p_sale_id
        )
      )
      OR (
        source_type = 'comissao'
        AND source_id = 'pdv:' || p_sale_id
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_financial_by_sale(
  p_organization_id UUID,
  p_sale_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  IF p_sale_id IS NULL OR btrim(p_sale_id) = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.financial_entries
  SET status = CASE WHEN paid_at IS NOT NULL THEN 'paid' ELSE 'open' END
  WHERE organization_id = p_organization_id
    AND status = 'cancelled'
    AND (
      (
        source_type = 'pdv'
        AND (
          source_id = p_sale_id
          OR source_id LIKE p_sale_id || ':%'
          OR source_id LIKE 'venda:' || p_sale_id || ':%'
          OR source_id = 'pdv:' || p_sale_id
        )
      )
      OR (
        source_type = 'comissao'
        AND source_id = 'pdv:' || p_sale_id
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_financial_by_sale(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_financial_by_sale(UUID, TEXT) TO authenticated, service_role;

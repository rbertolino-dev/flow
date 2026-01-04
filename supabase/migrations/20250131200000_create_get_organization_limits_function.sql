-- ============================================
-- Criar função RPC get_organization_limits
-- ============================================
-- Esta função retorna os limites de uma organização
-- Usada pelo ImportLeadsDialog e outros componentes

CREATE OR REPLACE FUNCTION public.get_organization_limits(_org_id UUID)
RETURNS TABLE (
  max_leads INTEGER,
  current_leads_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ol.max_leads, NULL)::INTEGER as max_leads,
    COALESCE(ol.current_leads_count, 
      (SELECT COUNT(*)::BIGINT 
       FROM public.leads 
       WHERE organization_id = _org_id 
         AND deleted_at IS NULL)
    )::BIGINT as current_leads_count
  FROM public.organization_limits ol
  WHERE ol.organization_id = _org_id
  LIMIT 1;
  
  -- Se não encontrou limites, retornar valores padrão
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      NULL::INTEGER as max_leads,
      (SELECT COUNT(*)::BIGINT 
       FROM public.leads 
       WHERE organization_id = _org_id 
         AND deleted_at IS NULL)::BIGINT as current_leads_count;
  END IF;
END;
$$;

-- Garantir que a função é acessível via RPC
GRANT EXECUTE ON FUNCTION public.get_organization_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_limits(UUID) TO anon;




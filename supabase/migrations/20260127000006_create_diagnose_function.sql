-- Migration: Criar função de diagnóstico para landing pages
-- Data: 2026-01-27
-- Descrição: Função para diagnosticar problemas de organização e privacidade em landing pages

-- =====================================================
-- Função de Diagnóstico
-- =====================================================

CREATE OR REPLACE FUNCTION public.diagnose_landing_page_issues()
RETURNS TABLE (
  issue_type TEXT,
  issue_description TEXT,
  affected_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'landing_page_items_org_mismatch'::TEXT,
    'Itens de landing page com produtos de organizações diferentes'::TEXT,
    COUNT(*)::BIGINT
  FROM public.landing_page_items lpi
  JOIN public.landing_pages lp ON lp.id = lpi.landing_page_id
  JOIN public.products p ON p.id = lpi.product_id
  WHERE lp.organization_id != p.organization_id;
  
  RETURN QUERY
  SELECT 
    'products_without_org'::TEXT,
    'Produtos sem organização'::TEXT,
    COUNT(*)::BIGINT
  FROM public.products
  WHERE organization_id IS NULL;
  
  RETURN QUERY
  SELECT 
    'landing_pages_without_org'::TEXT,
    'Landing pages sem organização'::TEXT,
    COUNT(*)::BIGINT
  FROM public.landing_pages
  WHERE organization_id IS NULL;
  
  RETURN QUERY
  SELECT 
    'orphaned_landing_page_items'::TEXT,
    'Itens de landing page órfãos (landing page não existe)'::TEXT,
    COUNT(*)::BIGINT
  FROM public.landing_page_items lpi
  WHERE NOT EXISTS (
    SELECT 1 FROM public.landing_pages lp WHERE lp.id = lpi.landing_page_id
  );
  
  RETURN QUERY
  SELECT 
    'orphaned_products_in_items'::TEXT,
    'Itens de landing page com produtos que não existem'::TEXT,
    COUNT(*)::BIGINT
  FROM public.landing_page_items lpi
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = lpi.product_id
  );
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.diagnose_landing_page_issues() IS 
'Diagnostica problemas de organização e privacidade em landing pages. Execute: SELECT * FROM public.diagnose_landing_page_issues();';

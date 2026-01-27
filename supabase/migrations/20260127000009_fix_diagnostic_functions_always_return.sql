-- Migration: Corrigir Funções de Diagnóstico para Sempre Retornar Dados
-- Data: 2026-01-27
-- Descrição: Ajusta funções de diagnóstico para sempre retornar resultados,
--            mesmo quando não há problemas, facilitando verificação

-- =====================================================
-- PROBLEMA: Funções podem não retornar dados quando COUNT = 0
-- =====================================================
-- Quando COUNT(*) = 0, jsonb_agg retorna NULL e a query pode não retornar linha.
-- Vamos garantir que sempre retorne pelo menos uma linha por verificação.

-- =====================================================
-- PARTE 1: Corrigir função diagnose_landing_page_organization_sync
-- =====================================================

CREATE OR REPLACE FUNCTION public.diagnose_landing_page_organization_sync()
RETURNS TABLE (
  check_type TEXT,
  status TEXT,
  description TEXT,
  affected_count BIGINT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Verificar itens com produtos de organizações diferentes
  RETURN QUERY
  SELECT 
    'organization_mismatch'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END,
    'Itens de landing page com produtos de organizações diferentes'::TEXT,
    COUNT(*)::BIGINT,
    CASE 
      WHEN COUNT(*) = 0 THEN jsonb_build_object('message', 'Nenhum problema encontrado')
      ELSE jsonb_build_object(
        'items', jsonb_agg(
          jsonb_build_object(
            'item_id', lpi.id,
            'landing_page_id', lp.id,
            'landing_page_org', lp.organization_id,
            'product_id', p.id,
            'product_org', p.organization_id
          )
        )
      )
    END
  FROM public.landing_page_items lpi
  JOIN public.landing_pages lp ON lp.id = lpi.landing_page_id
  JOIN public.products p ON p.id = lpi.product_id
  WHERE lp.organization_id != p.organization_id;
  
  -- Se não retornou linha (COUNT = 0), retornar linha de sucesso
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      'organization_mismatch'::TEXT,
      'OK'::TEXT,
      'Itens de landing page com produtos de organizações diferentes'::TEXT,
      0::BIGINT,
      jsonb_build_object('message', 'Nenhum problema encontrado - todos os itens estão sincronizados');
  END IF;
  
  -- 2. Verificar produtos sem organização
  RETURN QUERY
  SELECT 
    'products_without_org'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END,
    'Produtos sem organização definida'::TEXT,
    COUNT(*)::BIGINT,
    CASE 
      WHEN COUNT(*) = 0 THEN jsonb_build_object('message', 'Nenhum problema encontrado')
      ELSE jsonb_build_object(
        'products', jsonb_agg(jsonb_build_object('id', id, 'name', name))
      )
    END
  FROM public.products
  WHERE organization_id IS NULL;
  
  -- Se não retornou linha, retornar linha de sucesso
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      'products_without_org'::TEXT,
      'OK'::TEXT,
      'Produtos sem organização definida'::TEXT,
      0::BIGINT,
      jsonb_build_object('message', 'Nenhum problema encontrado - todos os produtos têm organização');
  END IF;
  
  -- 3. Verificar landing pages sem organização
  RETURN QUERY
  SELECT 
    'landing_pages_without_org'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END,
    'Landing pages sem organização definida'::TEXT,
    COUNT(*)::BIGINT,
    CASE 
      WHEN COUNT(*) = 0 THEN jsonb_build_object('message', 'Nenhum problema encontrado')
      ELSE jsonb_build_object(
        'landing_pages', jsonb_agg(jsonb_build_object('id', id, 'slug', slug))
      )
    END
  FROM public.landing_pages
  WHERE organization_id IS NULL;
  
  -- Se não retornou linha, retornar linha de sucesso
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      'landing_pages_without_org'::TEXT,
      'OK'::TEXT,
      'Landing pages sem organização definida'::TEXT,
      0::BIGINT,
      jsonb_build_object('message', 'Nenhum problema encontrado - todas as landing pages têm organização');
  END IF;
  
  -- 4. Verificar produtos ativos que não aparecem na landing page (quando show_all_items = false)
  RETURN QUERY
  SELECT 
    'products_not_in_landing_page'::TEXT,
    'INFO'::TEXT,
    'Produtos ativos da organização que não estão na landing page'::TEXT,
    COUNT(*)::BIGINT,
    jsonb_build_object(
      'landing_page_id', lp.id,
      'landing_page_slug', lp.slug,
      'organization_id', lp.organization_id,
      'show_all_items', lp.show_all_items,
      'products', COALESCE(
        jsonb_agg(
          jsonb_build_object('id', p.id, 'name', p.name, 'is_active', p.is_active)
        ),
        '[]'::jsonb
      )
    )
  FROM public.landing_pages lp
  LEFT JOIN public.products p ON p.organization_id = lp.organization_id
    AND p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.landing_page_items lpi
      WHERE lpi.landing_page_id = lp.id
        AND lpi.product_id = p.id
        AND lpi.is_visible = true
    )
  WHERE lp.show_all_items = false
  GROUP BY lp.id, lp.slug, lp.organization_id, lp.show_all_items;
  
  -- 5. Verificar políticas RLS ativas
  RETURN QUERY
  SELECT 
    'rls_policies_status'::TEXT,
    'INFO'::TEXT,
    'Status das políticas RLS'::TEXT,
    COUNT(*)::BIGINT,
    jsonb_build_object(
      'policies', COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'schemaname', schemaname,
            'tablename', tablename,
            'policyname', policyname,
            'permissive', permissive,
            'roles', roles,
            'cmd', cmd
          )
        ),
        '[]'::jsonb
      )
    )
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('landing_pages', 'landing_page_items', 'products');
  
  -- 6. Verificar triggers ativos
  RETURN QUERY
  SELECT 
    'triggers_status'::TEXT,
    'INFO'::TEXT,
    'Status dos triggers'::TEXT,
    COUNT(*)::BIGINT,
    jsonb_build_object(
      'triggers', COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'trigger_name', trigger_name,
            'event_manipulation', event_manipulation,
            'event_object_table', event_object_table,
            'action_statement', action_statement
          )
        ),
        '[]'::jsonb
      )
    )
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND event_object_table IN ('landing_pages', 'landing_page_items', 'products');
END;
$$;

-- =====================================================
-- PARTE 2: Criar função de teste simples
-- =====================================================

CREATE OR REPLACE FUNCTION public.test_diagnostic_functions()
RETURNS TABLE (
  function_name TEXT,
  exists BOOLEAN,
  can_execute BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_error TEXT;
BEGIN
  -- Testar diagnose_landing_page_organization_sync
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.diagnose_landing_page_organization_sync();
    
    RETURN QUERY
    SELECT 
      'diagnose_landing_page_organization_sync'::TEXT,
      true,
      true,
      NULL::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY
      SELECT 
        'diagnose_landing_page_organization_sync'::TEXT,
        true,
        false,
        SQLERRM;
  END;
  
  -- Testar check_product_visibility
  BEGIN
    -- Tentar executar com NULL para ver se função existe
    PERFORM public.check_product_visibility(NULL::UUID, NULL::UUID);
    
    RETURN QUERY
    SELECT 
      'check_product_visibility'::TEXT,
      true,
      true,
      NULL::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY
      SELECT 
        'check_product_visibility'::TEXT,
        true,
        false,
        SQLERRM;
  END;
END;
$$;

-- =====================================================
-- PARTE 3: Criar função de diagnóstico simplificada (sempre retorna dados)
-- =====================================================

CREATE OR REPLACE FUNCTION public.diagnose_landing_page_simple()
RETURNS TABLE (
  check_type TEXT,
  status TEXT,
  message TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- 1. Verificar itens com produtos de organizações diferentes
  SELECT COUNT(*) INTO v_count
  FROM public.landing_page_items lpi
  JOIN public.landing_pages lp ON lp.id = lpi.landing_page_id
  JOIN public.products p ON p.id = lpi.product_id
  WHERE lp.organization_id != p.organization_id;
  
  RETURN QUERY
  SELECT 
    'organization_mismatch'::TEXT,
    CASE WHEN v_count = 0 THEN 'OK' ELSE 'ERROR' END,
    CASE 
      WHEN v_count = 0 THEN 'Todos os itens estão sincronizados corretamente'
      ELSE format('Encontrados %s itens com produtos de organizações diferentes', v_count)
    END,
    v_count;
  
  -- 2. Verificar produtos sem organização
  SELECT COUNT(*) INTO v_count
  FROM public.products
  WHERE organization_id IS NULL;
  
  RETURN QUERY
  SELECT 
    'products_without_org'::TEXT,
    CASE WHEN v_count = 0 THEN 'OK' ELSE 'WARNING' END,
    CASE 
      WHEN v_count = 0 THEN 'Todos os produtos têm organização definida'
      ELSE format('Encontrados %s produtos sem organização', v_count)
    END,
    v_count;
  
  -- 3. Verificar landing pages sem organização
  SELECT COUNT(*) INTO v_count
  FROM public.landing_pages
  WHERE organization_id IS NULL;
  
  RETURN QUERY
  SELECT 
    'landing_pages_without_org'::TEXT,
    CASE WHEN v_count = 0 THEN 'OK' ELSE 'ERROR' END,
    CASE 
      WHEN v_count = 0 THEN 'Todas as landing pages têm organização definida'
      ELSE format('Encontradas %s landing pages sem organização', v_count)
    END,
    v_count;
  
  -- 4. Contar total de landing pages
  SELECT COUNT(*) INTO v_count
  FROM public.landing_pages;
  
  RETURN QUERY
  SELECT 
    'total_landing_pages'::TEXT,
    'INFO'::TEXT,
    format('Total de %s landing pages cadastradas', v_count),
    v_count;
  
  -- 5. Contar total de produtos
  SELECT COUNT(*) INTO v_count
  FROM public.products;
  
  RETURN QUERY
  SELECT 
    'total_products'::TEXT,
    'INFO'::TEXT,
    format('Total de %s produtos cadastrados', v_count),
    v_count;
  
  -- 6. Contar total de itens de landing page
  SELECT COUNT(*) INTO v_count
  FROM public.landing_page_items;
  
  RETURN QUERY
  SELECT 
    'total_landing_page_items'::TEXT,
    'INFO'::TEXT,
    format('Total de %s itens em landing pages', v_count),
    v_count;
END;
$$;

-- =====================================================
-- PARTE 4: Comentários
-- =====================================================

COMMENT ON FUNCTION public.diagnose_landing_page_organization_sync() IS 
'Diagnostica problemas de sincronização. SEMPRE retorna dados, mesmo quando não há problemas. Execute: SELECT * FROM public.diagnose_landing_page_organization_sync();';

COMMENT ON FUNCTION public.diagnose_landing_page_simple() IS 
'Versão simplificada do diagnóstico que SEMPRE retorna dados. Execute: SELECT * FROM public.diagnose_landing_page_simple();';

COMMENT ON FUNCTION public.test_diagnostic_functions() IS 
'Testa se as funções de diagnóstico existem e podem ser executadas. Execute: SELECT * FROM public.test_diagnostic_functions();';

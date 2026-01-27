-- Migration: Check-up COMPLETO do Módulo Landing Page
-- Data: 2026-01-27
-- Descrição: 
--   1. Verifica e corrige sincronização de organização
--   2. Analisa políticas RLS de privacidade
--   3. Verifica visibilidade de produtos
--   4. Garante que produtos aparecem na landing page correta
--   5. Valida Edge Functions e triggers
--   6. Corrige inconsistências encontradas

-- =====================================================
-- PARTE 1: FUNÇÕES DE DIAGNÓSTICO
-- =====================================================

-- Função para diagnosticar problemas de organização
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
    jsonb_build_object(
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
  FROM public.landing_page_items lpi
  JOIN public.landing_pages lp ON lp.id = lpi.landing_page_id
  JOIN public.products p ON p.id = lpi.product_id
  WHERE lp.organization_id != p.organization_id;
  
  -- 2. Verificar produtos sem organização
  RETURN QUERY
  SELECT 
    'products_without_org'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END,
    'Produtos sem organização definida'::TEXT,
    COUNT(*)::BIGINT,
    jsonb_build_object(
      'products', jsonb_agg(jsonb_build_object('id', id, 'name', name))
    )
  FROM public.products
  WHERE organization_id IS NULL;
  
  -- 3. Verificar landing pages sem organização
  RETURN QUERY
  SELECT 
    'landing_pages_without_org'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END,
    'Landing pages sem organização definida'::TEXT,
    COUNT(*)::BIGINT,
    jsonb_build_object(
      'landing_pages', jsonb_agg(jsonb_build_object('id', id, 'slug', slug))
    )
  FROM public.landing_pages
  WHERE organization_id IS NULL;
  
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
      'products', jsonb_agg(
        jsonb_build_object('id', p.id, 'name', p.name, 'is_active', p.is_active)
      )
    )
  FROM public.landing_pages lp
  JOIN public.products p ON p.organization_id = lp.organization_id
  WHERE lp.show_all_items = false
    AND p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.landing_page_items lpi
      WHERE lpi.landing_page_id = lp.id
        AND lpi.product_id = p.id
        AND lpi.is_visible = true
    )
  GROUP BY lp.id, lp.slug, lp.organization_id, lp.show_all_items;
  
  -- 5. Verificar políticas RLS ativas
  RETURN QUERY
  SELECT 
    'rls_policies_status'::TEXT,
    'INFO'::TEXT,
    'Status das políticas RLS'::TEXT,
    COUNT(*)::BIGINT,
    jsonb_build_object(
      'policies', jsonb_agg(
        jsonb_build_object(
          'schemaname', schemaname,
          'tablename', tablename,
          'policyname', policyname,
          'permissive', permissive,
          'roles', roles,
          'cmd', cmd
        )
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
      'triggers', jsonb_agg(
        jsonb_build_object(
          'trigger_name', trigger_name,
          'event_manipulation', event_manipulation,
          'event_object_table', event_object_table,
          'action_statement', action_statement
        )
      )
    )
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND event_object_table IN ('landing_pages', 'landing_page_items', 'products');
END;
$$;

-- Função para verificar visibilidade de produtos
CREATE OR REPLACE FUNCTION public.check_product_visibility(
  p_landing_page_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  is_active BOOLEAN,
  is_in_landing_page BOOLEAN,
  is_visible BOOLEAN,
  organization_match BOOLEAN,
  can_user_see BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_landing_page_org_id UUID;
  v_user_org_ids UUID[];
BEGIN
  -- Obter organização da landing page
  SELECT organization_id INTO v_landing_page_org_id
  FROM public.landing_pages
  WHERE id = p_landing_page_id;
  
  IF v_landing_page_org_id IS NULL THEN
    RAISE EXCEPTION 'Landing page com ID % não existe', p_landing_page_id;
  END IF;
  
  -- Obter organizações do usuário (se fornecido)
  IF p_user_id IS NOT NULL THEN
    SELECT ARRAY_AGG(organization_id) INTO v_user_org_ids
    FROM public.organization_members
    WHERE user_id = p_user_id;
  END IF;
  
  -- Retornar produtos da organização da landing page
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.is_active,
    EXISTS(
      SELECT 1 FROM public.landing_page_items lpi
      WHERE lpi.landing_page_id = p_landing_page_id
        AND lpi.product_id = p.id
    ) AS is_in_landing_page,
    COALESCE(
      (SELECT is_visible FROM public.landing_page_items lpi
       WHERE lpi.landing_page_id = p_landing_page_id
         AND lpi.product_id = p.id
       LIMIT 1),
      true
    ) AS is_visible,
    (p.organization_id = v_landing_page_org_id) AS organization_match,
    (p_user_id IS NULL OR v_landing_page_org_id = ANY(v_user_org_ids)) AS can_user_see
  FROM public.products p
  WHERE p.organization_id = v_landing_page_org_id
  ORDER BY p.name;
END;
$$;

-- =====================================================
-- PARTE 2: CORREÇÕES AUTOMÁTICAS
-- =====================================================

-- Remover itens com produtos de organizações diferentes
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.landing_page_items
  WHERE id IN (
    SELECT lpi.id
    FROM public.landing_page_items lpi
    JOIN public.landing_pages lp ON lp.id = lpi.landing_page_id
    JOIN public.products p ON p.id = lpi.product_id
    WHERE lp.organization_id != p.organization_id
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  IF v_count > 0 THEN
    RAISE NOTICE 'Removidos % itens com produtos de organizações diferentes', v_count;
  END IF;
END $$;

-- =====================================================
-- PARTE 3: GARANTIR POLÍTICAS RLS CORRETAS
-- =====================================================

-- Política para produtos: Usuários veem produtos da sua organização
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
CREATE POLICY "Users can view products of their organization"
ON public.products FOR SELECT
USING (
  -- CASO 1: Usuário autenticado e produto pertence à organização do usuário
  (
    auth.uid() IS NOT NULL
    AND organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  )
  OR
  -- CASO 2: Super admin ou pubdigital user
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
  OR
  -- CASO 3: Leitura pública quando há landing page ativa
  (
    is_active = true
    AND EXISTS (
      SELECT 1 
      FROM public.landing_pages lp
      WHERE lp.organization_id = products.organization_id
        AND lp.is_active = true
    )
  )
);

-- Política para landing_page_items: Usuários veem itens das suas landing pages
DROP POLICY IF EXISTS "Users can view landing page items" ON public.landing_page_items;
CREATE POLICY "Users can view landing page items"
ON public.landing_page_items FOR SELECT
USING (
  -- Usuários autenticados podem ver itens das suas landing pages
  landing_page_id IN (
    SELECT id FROM public.landing_pages
    WHERE organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  )
  OR
  -- Público pode ver itens de landing pages ativas
  landing_page_id IN (
    SELECT id FROM public.landing_pages
    WHERE is_active = true
  )
);

-- Política para landing_page_items: Usuários podem gerenciar itens
DROP POLICY IF EXISTS "Users can manage landing page items" ON public.landing_page_items;
CREATE POLICY "Users can manage landing page items"
ON public.landing_page_items FOR ALL
USING (
  landing_page_id IN (
    SELECT id FROM public.landing_pages
    WHERE organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  )
)
WITH CHECK (
  landing_page_id IN (
    SELECT id FROM public.landing_pages
    WHERE organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  )
);

-- =====================================================
-- PARTE 4: GARANTIR TRIGGER DE VALIDAÇÃO
-- =====================================================

-- Recriar função de validação com bypass completo de RLS
CREATE OR REPLACE FUNCTION public.validate_landing_page_item_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  landing_page_org_id UUID;
  product_org_id UUID;
  product_exists BOOLEAN;
BEGIN
  -- Bypass RLS temporariamente
  SET LOCAL row_security = off;
  
  -- Obter organização da landing page
  SELECT organization_id INTO landing_page_org_id
  FROM public.landing_pages
  WHERE id = NEW.landing_page_id;
  
  IF landing_page_org_id IS NULL THEN
    RAISE EXCEPTION 'Landing page com ID % não existe', NEW.landing_page_id;
  END IF;
  
  -- Verificar se produto existe
  SELECT EXISTS(
    SELECT 1 FROM public.products WHERE id = NEW.product_id
  ) INTO product_exists;
  
  IF NOT product_exists THEN
    RAISE EXCEPTION 'Produto com ID % não existe', NEW.product_id;
  END IF;
  
  -- Obter organização do produto
  SELECT organization_id INTO product_org_id
  FROM public.products
  WHERE id = NEW.product_id;
  
  IF product_org_id IS NULL THEN
    RAISE EXCEPTION 'Produto com ID % não tem organização definida', NEW.product_id;
  END IF;
  
  -- Verificar se produto pertence à mesma organização
  IF product_org_id != landing_page_org_id THEN
    RAISE EXCEPTION 'Produto não pertence à mesma organização da landing page. Produto: %, Landing Page: %', 
      product_org_id, landing_page_org_id;
  END IF;
  
  -- Restaurar RLS
  RESET row_security;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RESET row_security;
    RAISE;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS validate_landing_page_item_product_trigger ON public.landing_page_items;
CREATE TRIGGER validate_landing_page_item_product_trigger
  BEFORE INSERT OR UPDATE ON public.landing_page_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_landing_page_item_product();

-- =====================================================
-- PARTE 5: COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION public.diagnose_landing_page_organization_sync() IS 
'Diagnostica problemas de sincronização de organização entre landing pages e produtos. Execute: SELECT * FROM public.diagnose_landing_page_organization_sync();';

COMMENT ON FUNCTION public.check_product_visibility(p_landing_page_id UUID, p_user_id UUID) IS 
'Verifica visibilidade de produtos para uma landing page específica. Execute: SELECT * FROM public.check_product_visibility(''landing_page_id'', ''user_id'');';

COMMENT ON FUNCTION public.validate_landing_page_item_product() IS 
'Valida que produto existe e pertence à mesma organização da landing page antes de inserir. Usa SET LOCAL row_security = off para garantir bypass completo de RLS.';

-- =====================================================
-- PARTE 6: ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_landing_page_items_org_check 
ON public.landing_page_items(landing_page_id, product_id);

CREATE INDEX IF NOT EXISTS idx_products_org_active 
ON public.products(organization_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_landing_pages_org_active 
ON public.landing_pages(organization_id, is_active) 
WHERE is_active = true;

-- ============================================
-- Script COMPLETO: Correção de Seleção e Visualização de Produtos
-- ============================================
-- Execute este script NO SUPABASE DASHBOARD (SQL Editor)
-- Resolve TODOS os problemas de seleção e visualização de produtos
-- ============================================

-- =====================================================
-- PARTE 1: Função de Diagnóstico Simplificada (SEMPRE retorna)
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
  SELECT COUNT(*) INTO v_count FROM public.landing_pages;
  RETURN QUERY
  SELECT 
    'total_landing_pages'::TEXT,
    'INFO'::TEXT,
    format('Total de %s landing pages cadastradas', v_count),
    v_count;
  
  -- 5. Contar total de produtos
  SELECT COUNT(*) INTO v_count FROM public.products;
  RETURN QUERY
  SELECT 
    'total_products'::TEXT,
    'INFO'::TEXT,
    format('Total de %s produtos cadastrados', v_count),
    v_count;
  
  -- 6. Contar total de itens de landing page
  SELECT COUNT(*) INTO v_count FROM public.landing_page_items;
  RETURN QUERY
  SELECT 
    'total_landing_page_items'::TEXT,
    'INFO'::TEXT,
    format('Total de %s itens em landing pages', v_count),
    v_count;
END;
$$;

-- =====================================================
-- PARTE 2: Remover dados inconsistentes
-- =====================================================

-- Remover itens com produtos de organizações diferentes
DELETE FROM public.landing_page_items
WHERE id IN (
  SELECT lpi.id
  FROM public.landing_page_items lpi
  JOIN public.landing_pages lp ON lp.id = lpi.landing_page_id
  JOIN public.products p ON p.id = lpi.product_id
  WHERE lp.organization_id != p.organization_id
);

-- =====================================================
-- PARTE 3: Garantir Políticas RLS CORRETAS para Produtos
-- =====================================================

-- Remover TODAS as políticas antigas de produtos
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
DROP POLICY IF EXISTS "Public can view products for active landing pages" ON public.products;
DROP POLICY IF EXISTS "Users can manage products" ON public.products;

-- Criar política UNIFICADA que permite:
-- 1. Usuários autenticados veem produtos da sua organização
-- 2. Público vê produtos ativos quando há landing page ativa
-- 3. Super admins veem tudo
CREATE POLICY "Users can view products of their organization"
ON public.products FOR SELECT
USING (
  -- CASO 1: Super admin ou pubdigital user (veem tudo)
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
  OR
  -- CASO 2: Usuário autenticado e produto pertence à organização do usuário
  (
    auth.uid() IS NOT NULL
    AND organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  )
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

-- =====================================================
-- PARTE 4: Garantir Políticas RLS para landing_page_items
-- =====================================================

-- Remover TODAS as políticas antigas
DROP POLICY IF EXISTS "Users can view landing page items" ON public.landing_page_items;
DROP POLICY IF EXISTS "Users can manage landing page items" ON public.landing_page_items;
DROP POLICY IF EXISTS "Public can view landing page items" ON public.landing_page_items;

-- Política de SELECT: Usuários veem itens das suas landing pages, público vê itens de landing pages ativas
CREATE POLICY "Users can view landing page items"
ON public.landing_page_items FOR SELECT
USING (
  -- Super admin ou pubdigital user (veem tudo)
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
  OR
  -- Usuários autenticados podem ver itens das suas landing pages
  landing_page_id IN (
    SELECT id FROM public.landing_pages
    WHERE organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  )
  OR
  -- Público pode ver itens de landing pages ativas
  landing_page_id IN (
    SELECT id FROM public.landing_pages
    WHERE is_active = true
  )
);

-- Política de INSERT/UPDATE/DELETE: Apenas usuários da organização podem gerenciar
CREATE POLICY "Users can manage landing page items"
ON public.landing_page_items FOR ALL
USING (
  -- Super admin ou pubdigital user (podem gerenciar tudo)
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
  OR
  -- Usuários da organização podem gerenciar
  landing_page_id IN (
    SELECT id FROM public.landing_pages
    WHERE organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  -- Super admin ou pubdigital user (podem gerenciar tudo)
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
  OR
  -- Usuários da organização podem gerenciar
  landing_page_id IN (
    SELECT id FROM public.landing_pages
    WHERE organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- =====================================================
-- PARTE 5: Garantir Trigger de Validação com Bypass RLS COMPLETO
-- =====================================================

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
  -- Bypass RLS COMPLETO temporariamente
  SET LOCAL row_security = off;
  
  -- Obter organização da landing page (bypass RLS)
  SELECT organization_id INTO landing_page_org_id
  FROM public.landing_pages
  WHERE id = NEW.landing_page_id;
  
  IF landing_page_org_id IS NULL THEN
    RESET row_security;
    RAISE EXCEPTION 'Landing page com ID % não existe', NEW.landing_page_id;
  END IF;
  
  -- Verificar se produto existe (bypass RLS)
  SELECT EXISTS(
    SELECT 1 FROM public.products WHERE id = NEW.product_id
  ) INTO product_exists;
  
  IF NOT product_exists THEN
    RESET row_security;
    RAISE EXCEPTION 'Produto com ID % não existe', NEW.product_id;
  END IF;
  
  -- Obter organização do produto (bypass RLS)
  SELECT organization_id INTO product_org_id
  FROM public.products
  WHERE id = NEW.product_id;
  
  IF product_org_id IS NULL THEN
    RESET row_security;
    RAISE EXCEPTION 'Produto com ID % não tem organização definida', NEW.product_id;
  END IF;
  
  -- Verificar se produto pertence à mesma organização
  IF product_org_id != landing_page_org_id THEN
    RESET row_security;
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
-- PARTE 6: Função para Verificar Visibilidade de Produtos
-- =====================================================

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
  -- Bypass RLS para obter organização
  SET LOCAL row_security = off;
  
  -- Obter organização da landing page
  SELECT organization_id INTO v_landing_page_org_id
  FROM public.landing_pages
  WHERE id = p_landing_page_id;
  
  IF v_landing_page_org_id IS NULL THEN
    RESET row_security;
    RAISE EXCEPTION 'Landing page com ID % não existe', p_landing_page_id;
  END IF;
  
  -- Obter organizações do usuário (se fornecido)
  IF p_user_id IS NOT NULL THEN
    SELECT ARRAY_AGG(organization_id) INTO v_user_org_ids
    FROM public.organization_members
    WHERE user_id = p_user_id;
  END IF;
  
  -- Restaurar RLS
  RESET row_security;
  
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
-- PARTE 7: Função de Teste Simplificada
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
  -- Testar diagnose_landing_page_simple
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.diagnose_landing_page_simple();
    
    RETURN QUERY
    SELECT 
      'diagnose_landing_page_simple'::TEXT,
      true,
      true,
      NULL::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RETURN QUERY
      SELECT 
        'diagnose_landing_page_simple'::TEXT,
        false,
        false,
        v_error;
  END;
  
  -- Testar check_product_visibility (se existir)
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'check_product_visibility';
    
    IF v_count > 0 THEN
      RETURN QUERY
      SELECT 
        'check_product_visibility'::TEXT,
        true,
        true,
        'Função existe (requer parâmetros para executar)'::TEXT;
    ELSE
      RETURN QUERY
      SELECT 
        'check_product_visibility'::TEXT,
        false,
        false,
        'Função não encontrada'::TEXT;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RETURN QUERY
      SELECT 
        'check_product_visibility'::TEXT,
        false,
        false,
        v_error;
  END;
END;
$$;

-- =====================================================
-- PARTE 8: Comentários e Documentação
-- =====================================================

COMMENT ON FUNCTION public.diagnose_landing_page_simple() IS 
'Versão simplificada do diagnóstico que SEMPRE retorna dados. Execute: SELECT * FROM public.diagnose_landing_page_simple();';

COMMENT ON FUNCTION public.check_product_visibility(p_landing_page_id UUID, p_user_id UUID) IS 
'Verifica visibilidade de produtos para uma landing page específica. Execute: SELECT * FROM public.check_product_visibility(''landing_page_id'', ''user_id'');';

COMMENT ON FUNCTION public.validate_landing_page_item_product() IS 
'Valida que produto existe e pertence à mesma organização da landing page antes de inserir. Usa SET LOCAL row_security = off para garantir bypass completo de RLS.';

COMMENT ON FUNCTION public.test_diagnostic_functions() IS 
'Testa se as funções de diagnóstico existem. Execute: SELECT * FROM public.test_diagnostic_functions();';

COMMENT ON POLICY "Users can view products of their organization" ON public.products IS 
'Permite que usuários autenticados vejam produtos da sua organização, super admins vejam tudo, e público veja produtos quando há landing page ativa.';

COMMENT ON POLICY "Users can view landing page items" ON public.landing_page_items IS 
'Permite que usuários vejam itens das suas landing pages, super admins vejam tudo, e público veja itens de landing pages ativas.';

COMMENT ON POLICY "Users can manage landing page items" ON public.landing_page_items IS 
'Permite que usuários gerenciem itens de landing pages da sua organização e super admins gerenciem tudo. O trigger valida que produto pertence à mesma organização.';

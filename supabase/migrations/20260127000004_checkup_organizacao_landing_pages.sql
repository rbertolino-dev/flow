-- Migration: Checkup Completo de Organização e Privacidade - Landing Pages
-- Data: 2026-01-27
-- Descrição: 
--   1. Verifica e corrige inconsistências de organização
--   2. Remove itens de landing pages com produtos de organizações diferentes
--   3. Ajusta trigger para validar organização corretamente
--   4. Garante que apenas produtos da mesma organização possam ser adicionados
--   5. Verifica e corrige regras de privacidade

-- =====================================================
-- PASSO 1: Verificar e reportar inconsistências
-- =====================================================

-- Criar função para diagnosticar problemas
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

-- =====================================================
-- PASSO 2: Corrigir inconsistências automaticamente
-- =====================================================

-- Remover itens de landing page com produtos de organizações diferentes
DELETE FROM public.landing_page_items
WHERE id IN (
  SELECT lpi.id
  FROM public.landing_page_items lpi
  JOIN public.landing_pages lp ON lp.id = lpi.landing_page_id
  JOIN public.products p ON p.id = lpi.product_id
  WHERE lp.organization_id != p.organization_id
);

-- Remover itens órfãos (landing page não existe)
DELETE FROM public.landing_page_items
WHERE landing_page_id NOT IN (
  SELECT id FROM public.landing_pages
);

-- Remover itens com produtos que não existem
DELETE FROM public.landing_page_items
WHERE product_id NOT IN (
  SELECT id FROM public.products
);

-- =====================================================
-- PASSO 3: Ajustar função de validação para ser mais clara
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
  user_org_ids UUID[];
BEGIN
  -- Obter organização da landing page (bypass RLS)
  SELECT organization_id INTO landing_page_org_id
  FROM public.landing_pages
  WHERE id = NEW.landing_page_id;
  
  IF landing_page_org_id IS NULL THEN
    RAISE EXCEPTION 'Landing page com ID % não existe', NEW.landing_page_id;
  END IF;
  
  -- Obter organização do produto (bypass RLS)
  SELECT organization_id INTO product_org_id
  FROM public.products
  WHERE id = NEW.product_id;
  
  IF product_org_id IS NULL THEN
    RAISE EXCEPTION 'Produto com ID % não existe', NEW.product_id;
  END IF;
  
  -- Verificar se produto pertence à mesma organização da landing page
  IF product_org_id != landing_page_org_id THEN
    RAISE EXCEPTION 'Produto não pertence à mesma organização da landing page. Produto: %, Landing Page: %', 
      product_org_id, landing_page_org_id;
  END IF;
  
  -- Verificar se usuário atual tem acesso à organização (opcional, mas recomendado)
  IF auth.uid() IS NOT NULL THEN
    SELECT ARRAY_AGG(organization_id) INTO user_org_ids
    FROM public.organization_members
    WHERE user_id = auth.uid();
    
    -- Se usuário não é super admin, verificar se tem acesso
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) 
       AND NOT public.is_pubdigital_user(auth.uid())
       AND (user_org_ids IS NULL OR NOT (landing_page_org_id = ANY(user_org_ids))) THEN
      RAISE EXCEPTION 'Você não tem permissão para adicionar produtos a esta landing page';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS validate_landing_page_item_product_trigger ON public.landing_page_items;
CREATE TRIGGER validate_landing_page_item_product_trigger
  BEFORE INSERT OR UPDATE ON public.landing_page_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_landing_page_item_product();

-- =====================================================
-- PASSO 4: Ajustar política RLS de landing_page_items
-- =====================================================

-- Remover política antiga
DROP POLICY IF EXISTS "Users can manage landing page items" ON public.landing_page_items;

-- Criar política mais restritiva que verifica organização
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
  AND
  -- Garantir que produto pertence à mesma organização da landing page
  product_id IN (
    SELECT p.id
    FROM public.products p
    JOIN public.landing_pages lp ON lp.id = landing_page_id
    WHERE p.organization_id = lp.organization_id
  )
);

-- =====================================================
-- PASSO 5: Garantir que política de SELECT permite ver itens públicos
-- =====================================================

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

-- =====================================================
-- PASSO 6: Criar função para listar problemas encontrados
-- =====================================================

COMMENT ON FUNCTION public.diagnose_landing_page_issues() IS 
'Diagnostica problemas de organização e privacidade em landing pages. Execute: SELECT * FROM public.diagnose_landing_page_issues();';

-- =====================================================
-- PASSO 7: Criar índice para melhorar performance de verificações
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_landing_page_items_org_check 
ON public.landing_page_items(landing_page_id, product_id);

-- Comentários finais
COMMENT ON POLICY "Users can manage landing page items" ON public.landing_page_items IS 
'Permite que usuários gerenciem itens de landing pages da sua organização. Valida que produto pertence à mesma organização.';

COMMENT ON POLICY "Users can view landing page items" ON public.landing_page_items IS 
'Permite que usuários vejam itens das suas landing pages e público veja itens de landing pages ativas.';

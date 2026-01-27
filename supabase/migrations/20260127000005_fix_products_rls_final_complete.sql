-- Migration: Solução FINAL e COMPLETA para RLS de Produtos e Landing Pages
-- Data: 2026-01-27
-- Descrição: 
--   1. Remove dados inconsistentes (produtos de organizações diferentes)
--   2. Ajusta trigger para validar organização corretamente
--   3. Corrige políticas RLS para garantir privacidade
--   4. Garante que apenas produtos da mesma organização possam ser adicionados

-- =====================================================
-- PASSO 1: Limpar dados inconsistentes
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

-- =====================================================
-- PASSO 2: Remover políticas antigas
-- =====================================================

DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
DROP POLICY IF EXISTS "Public can view products for active landing pages" ON public.products;
DROP POLICY IF EXISTS "Users can create products for their organization" ON public.products;
DROP POLICY IF EXISTS "Users can update products of their organization" ON public.products;
DROP POLICY IF EXISTS "Users can delete products of their organization" ON public.products;

DROP POLICY IF EXISTS "Users can manage landing page items" ON public.landing_page_items;
DROP POLICY IF EXISTS "Users can view landing page items" ON public.landing_page_items;

-- =====================================================
-- PASSO 3: Criar função de verificação melhorada
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_product_exists_and_accessible(
  p_product_id UUID,
  p_organization_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_org_id UUID;
BEGIN
  -- Verificar se produto existe e obter organização (bypass RLS)
  SELECT organization_id INTO product_org_id
  FROM public.products
  WHERE id = p_product_id;
  
  -- Se produto não existe
  IF product_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Se organização foi fornecida, verificar se corresponde
  IF p_organization_id IS NOT NULL THEN
    RETURN product_org_id = p_organization_id;
  END IF;
  
  -- Produto existe
  RETURN TRUE;
END;
$$;

-- =====================================================
-- PASSO 4: Criar política RLS CORRIGIDA para produtos (SELECT)
-- =====================================================

CREATE POLICY "Users can view products of their organization"
ON public.products FOR SELECT
USING (
  -- CASO 1: Usuário autenticado e produto pertence à organização do usuário
  -- CRÍTICO: Esta condição permite verificação de foreign keys
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

-- =====================================================
-- PASSO 5: Criar políticas para INSERT, UPDATE, DELETE de produtos
-- =====================================================

CREATE POLICY "Users can create products for their organization"
ON public.products FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update products of their organization"
ON public.products FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete products of their organization"
ON public.products FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- =====================================================
-- PASSO 6: Ajustar foreign key
-- =====================================================

ALTER TABLE public.landing_page_items
  DROP CONSTRAINT IF EXISTS landing_page_items_product_id_fkey;

ALTER TABLE public.landing_page_items
  ADD CONSTRAINT landing_page_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE CASCADE;

-- =====================================================
-- PASSO 7: Criar trigger de validação CORRIGIDO
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
    RAISE EXCEPTION 'Produto não pertence à mesma organização da landing page. Produto pertence à organização %, mas landing page pertence à organização %', 
      product_org_id, landing_page_org_id;
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
-- PASSO 8: Criar políticas RLS para landing_page_items
-- =====================================================

-- Política de SELECT: Usuários veem itens das suas landing pages, público vê itens de landing pages ativas
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

-- Política de INSERT/UPDATE/DELETE: Apenas usuários da organização podem gerenciar
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
-- PASSO 9: Comentários explicativos
-- =====================================================

COMMENT ON POLICY "Users can view products of their organization" ON public.products IS 
'Permite que usuários autenticados vejam produtos da sua organização (CRÍTICO para verificação de foreign keys) e visitantes vejam produtos quando há landing page ativa.';

COMMENT ON FUNCTION public.validate_landing_page_item_product() IS 
'Valida que produto existe e pertence à mesma organização da landing page antes de inserir, bypassando RLS.';

COMMENT ON POLICY "Users can manage landing page items" ON public.landing_page_items IS 
'Permite que usuários gerenciem itens de landing pages da sua organização. O trigger valida que produto pertence à mesma organização.';

COMMENT ON POLICY "Users can view landing page items" ON public.landing_page_items IS 
'Permite que usuários vejam itens das suas landing pages e público veja itens de landing pages ativas.';

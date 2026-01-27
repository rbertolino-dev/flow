-- Migration: Solução COMPLETA para RLS de Produtos e Foreign Keys
-- Data: 2026-01-27
-- Descrição: Solução definitiva que garante que:
--            1. Usuários autenticados vejam produtos da sua organização
--            2. Foreign keys funcionem corretamente
--            3. Visitantes vejam produtos em landing pages ativas
--            4. Administradores possam gerenciar produtos

-- =====================================================
-- PASSO 1: Remover todas as políticas antigas
-- =====================================================
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
DROP POLICY IF EXISTS "Public can view products for active landing pages" ON public.products;
DROP POLICY IF EXISTS "Users can create products for their organization" ON public.products;
DROP POLICY IF EXISTS "Users can update products of their organization" ON public.products;
DROP POLICY IF EXISTS "Users can delete products of their organization" ON public.products;

-- =====================================================
-- PASSO 2: Criar função SECURITY DEFINER para verificar produtos
-- =====================================================
-- Esta função bypassa RLS e é usada para verificação de foreign keys
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

COMMENT ON FUNCTION public.check_product_exists_and_accessible(UUID, UUID) IS 
'Verifica se produto existe e está acessível, bypassando RLS. Usado para verificação de foreign keys.';

-- =====================================================
-- PASSO 3: Criar política RLS CORRIGIDA para SELECT
-- =====================================================
-- Esta política é CRÍTICA - deve permitir que usuários autenticados
-- vejam produtos da sua organização para verificação de foreign keys
CREATE POLICY "Users can view products of their organization"
ON public.products FOR SELECT
USING (
  -- CASO 1: Usuário autenticado e produto pertence à organização do usuário
  -- IMPORTANTE: Esta é a condição que permite verificação de foreign keys
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
-- PASSO 4: Criar políticas para INSERT, UPDATE, DELETE
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
-- PASSO 5: Ajustar foreign key para usar validação via trigger
-- =====================================================
-- Remover constraint antiga
ALTER TABLE public.landing_page_items
  DROP CONSTRAINT IF EXISTS landing_page_items_product_id_fkey;

-- Recriar foreign key (PostgreSQL ainda vai verificar, mas o trigger garante)
ALTER TABLE public.landing_page_items
  ADD CONSTRAINT landing_page_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE CASCADE;

-- =====================================================
-- PASSO 6: Criar trigger de validação (backup caso RLS bloqueie)
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_landing_page_item_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  landing_page_org_id UUID;
BEGIN
  -- Obter organização da landing page
  SELECT organization_id INTO landing_page_org_id
  FROM public.landing_pages
  WHERE id = NEW.landing_page_id;
  
  IF landing_page_org_id IS NULL THEN
    RAISE EXCEPTION 'Landing page com ID % não existe', NEW.landing_page_id;
  END IF;
  
  -- Verificar se produto existe e pertence à mesma organização (bypass RLS)
  IF NOT public.check_product_exists_and_accessible(NEW.product_id, landing_page_org_id) THEN
    RAISE EXCEPTION 'Produto com ID % não existe ou não pertence à organização da landing page', NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS validate_landing_page_item_product_trigger ON public.landing_page_items;
CREATE TRIGGER validate_landing_page_item_product_trigger
  BEFORE INSERT OR UPDATE ON public.landing_page_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_landing_page_item_product();

-- Comentários finais
COMMENT ON POLICY "Users can view products of their organization" ON public.products IS 
'Permite que usuários autenticados vejam produtos da sua organização (CRÍTICO para verificação de foreign keys) e visitantes vejam produtos quando há landing page ativa.';

COMMENT ON FUNCTION public.validate_landing_page_item_product() IS 
'Valida que produto existe e pertence à mesma organização da landing page antes de inserir, bypassando RLS como backup.';

-- Migration: Correção DEFINITIVA de RLS para permitir verificação de foreign keys
-- Data: 2026-01-27
-- Descrição: Cria função SECURITY DEFINER para verificação de foreign keys
--            e ajusta políticas RLS para garantir que usuários autenticados
--            possam ver produtos da sua organização

-- =====================================================
-- PROBLEMA: Foreign key constraint falha mesmo com RLS ajustado
-- =====================================================
-- Quando um usuário autenticado tenta inserir em landing_page_items,
-- o PostgreSQL verifica a foreign key no contexto do usuário.
-- Se a RLS bloquear a leitura do produto, a verificação falha.

-- =====================================================
-- SOLUÇÃO: Função SECURITY DEFINER + Política RLS Corrigida
-- =====================================================

-- 1. Remover políticas antigas
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
DROP POLICY IF EXISTS "Public can view products for active landing pages" ON public.products;

-- 2. Criar função para verificar se produto existe (bypass RLS)
CREATE OR REPLACE FUNCTION public.check_product_exists(product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se produto existe (bypass RLS usando SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 
    FROM public.products 
    WHERE id = product_id
  );
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.check_product_exists(UUID) IS 
'Verifica se um produto existe, bypassando RLS. Usado para verificação de foreign keys.';

-- 3. Política RLS CORRIGIDA: Permitir que usuários autenticados vejam produtos da sua organização
-- Esta política é CRÍTICA para permitir verificação de foreign keys
CREATE POLICY "Users can view products of their organization"
ON public.products FOR SELECT
USING (
  -- CASO 1: Usuário autenticado e produto pertence à organização do usuário
  -- IMPORTANTE: Esta condição permite verificação de foreign keys
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
  -- CASO 3: Leitura pública quando há landing page ativa (para visitantes não autenticados)
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

-- 4. Garantir que outras políticas existam
DROP POLICY IF EXISTS "Users can create products for their organization" ON public.products;
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

DROP POLICY IF EXISTS "Users can update products of their organization" ON public.products;
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

DROP POLICY IF EXISTS "Users can delete products of their organization" ON public.products;
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

-- 5. Criar trigger para validar produto antes de inserir em landing_page_items
-- Isso garante que o produto existe mesmo se RLS bloquear
CREATE OR REPLACE FUNCTION public.validate_landing_page_item_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se produto existe usando função SECURITY DEFINER
  IF NOT public.check_product_exists(NEW.product_id) THEN
    RAISE EXCEPTION 'Produto com ID % não existe ou não está acessível', NEW.product_id;
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

-- Comentários explicativos
COMMENT ON POLICY "Users can view products of their organization" ON public.products IS 
'Permite que usuários autenticados vejam produtos da sua organização (CRÍTICO para verificação de foreign keys) e visitantes vejam produtos quando há landing page ativa.';

COMMENT ON FUNCTION public.validate_landing_page_item_product() IS 
'Valida que produto existe antes de inserir em landing_page_items, bypassando RLS.';

-- Migration: Correção DEFINITIVA do Trigger - Bypass RLS Completo
-- Data: 2026-01-27
-- Descrição: Ajusta trigger para garantir bypass completo de RLS na verificação de produtos

-- =====================================================
-- PROBLEMA: Trigger não consegue ver produto devido a RLS
-- =====================================================
-- Mesmo com SECURITY DEFINER, o trigger pode não conseguir
-- ver o produto se a RLS estiver bloqueando. Precisamos
-- garantir bypass completo usando SET LOCAL.

-- =====================================================
-- PASSO 1: Recriar função de validação com bypass completo de RLS
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
  -- Bypass RLS temporariamente para esta função
  SET LOCAL row_security = off;
  
  -- Obter organização da landing page (bypass RLS)
  SELECT organization_id INTO landing_page_org_id
  FROM public.landing_pages
  WHERE id = NEW.landing_page_id;
  
  IF landing_page_org_id IS NULL THEN
    RAISE EXCEPTION 'Landing page com ID % não existe', NEW.landing_page_id;
  END IF;
  
  -- Verificar se produto existe (bypass RLS completo)
  SELECT EXISTS(
    SELECT 1 FROM public.products WHERE id = NEW.product_id
  ) INTO product_exists;
  
  IF NOT product_exists THEN
    RAISE EXCEPTION 'Produto com ID % não existe', NEW.product_id;
  END IF;
  
  -- Obter organização do produto (bypass RLS)
  SELECT organization_id INTO product_org_id
  FROM public.products
  WHERE id = NEW.product_id;
  
  IF product_org_id IS NULL THEN
    RAISE EXCEPTION 'Produto com ID % não tem organização definida', NEW.product_id;
  END IF;
  
  -- Verificar se produto pertence à mesma organização da landing page
  IF product_org_id != landing_page_org_id THEN
    RAISE EXCEPTION 'Produto não pertence à mesma organização da landing page. Produto pertence à organização %, mas landing page pertence à organização %', 
      product_org_id, landing_page_org_id;
  END IF;
  
  -- Restaurar RLS
  RESET row_security;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Restaurar RLS em caso de erro
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
-- PASSO 2: Garantir que política RLS permite leitura de produtos
-- =====================================================

-- Verificar se política existe e recriar se necessário
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;

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
-- PASSO 3: Comentários explicativos
-- =====================================================

COMMENT ON FUNCTION public.validate_landing_page_item_product() IS 
'Valida que produto existe e pertence à mesma organização da landing page antes de inserir. Usa SET LOCAL row_security = off para garantir bypass completo de RLS.';

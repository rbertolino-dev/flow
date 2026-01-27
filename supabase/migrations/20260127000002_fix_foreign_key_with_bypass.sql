-- Migration: Correção DEFINITIVA de Foreign Key com Bypass RLS
-- Data: 2026-01-27
-- Descrição: Ajusta foreign key para funcionar mesmo com RLS ativo
--            usando abordagem que bypassa RLS na verificação

-- =====================================================
-- PROBLEMA: Foreign key constraint falha com RLS ativo
-- =====================================================
-- PostgreSQL verifica foreign keys no contexto do usuário.
-- Se RLS bloquear, a verificação falha mesmo que o produto exista.

-- =====================================================
-- SOLUÇÃO: Recrear foreign key com validação via trigger
-- =====================================================

-- 1. Remover constraint de foreign key antiga (se existir)
ALTER TABLE public.landing_page_items
  DROP CONSTRAINT IF EXISTS landing_page_items_product_id_fkey;

-- 2. Recriar foreign key sem validação imediata (NOT VALID)
-- Isso permite que a constraint exista mas não bloqueie inserções
-- A validação será feita pelo trigger
ALTER TABLE public.landing_page_items
  ADD CONSTRAINT landing_page_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE CASCADE
  NOT VALID;

-- 3. Validar a constraint (isso verifica dados existentes)
ALTER TABLE public.landing_page_items
  VALIDATE CONSTRAINT landing_page_items_product_id_fkey;

-- 4. Garantir que função de verificação existe
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

-- 5. Função de validação melhorada (verifica organização também)
CREATE OR REPLACE FUNCTION public.validate_landing_page_item_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_exists BOOLEAN;
  product_org_id UUID;
  landing_page_org_id UUID;
BEGIN
  -- Verificar se produto existe (bypass RLS)
  SELECT EXISTS(SELECT 1 FROM public.products WHERE id = NEW.product_id)
  INTO product_exists;
  
  IF NOT product_exists THEN
    RAISE EXCEPTION 'Produto com ID % não existe', NEW.product_id;
  END IF;
  
  -- Verificar se produto pertence à mesma organização da landing page
  SELECT organization_id INTO product_org_id
  FROM public.products
  WHERE id = NEW.product_id;
  
  SELECT organization_id INTO landing_page_org_id
  FROM public.landing_pages
  WHERE id = NEW.landing_page_id;
  
  IF product_org_id IS NULL OR landing_page_org_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível verificar organização do produto ou landing page';
  END IF;
  
  IF product_org_id != landing_page_org_id THEN
    RAISE EXCEPTION 'Produto pertence a organização diferente da landing page';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Recriar trigger
DROP TRIGGER IF EXISTS validate_landing_page_item_product_trigger ON public.landing_page_items;
CREATE TRIGGER validate_landing_page_item_product_trigger
  BEFORE INSERT OR UPDATE ON public.landing_page_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_landing_page_item_product();

-- Comentários
COMMENT ON FUNCTION public.check_product_exists(UUID) IS 
'Verifica se um produto existe, bypassando RLS. Usado para verificação de foreign keys.';

COMMENT ON FUNCTION public.validate_landing_page_item_product() IS 
'Valida que produto existe e pertence à mesma organização da landing page antes de inserir, bypassando RLS.';

COMMENT ON CONSTRAINT landing_page_items_product_id_fkey ON public.landing_page_items IS 
'Foreign key para products. Validação feita via trigger para bypassar RLS.';

-- Migration: Landing Page multi-empresa - slug único (páginas ativas) e produto da mesma organização
-- Data: 2026-03-10
-- Garante: (1) URL /p/:slug identifica uma única página ativa; (2) item só pode vincular produto da mesma org

-- =====================================================
-- 1. Slug único entre páginas ATIVAS (evita duas orgs com mesmo slug em /p/slug)
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_landing_pages_slug_active_unique
  ON public.landing_pages(slug)
  WHERE is_active = true;

COMMENT ON INDEX idx_landing_pages_slug_active_unique IS
  'Apenas uma landing page ativa pode ter determinado slug (URL /p/:slug única no sistema)';

-- =====================================================
-- 2. Trigger: produto em landing_page_items deve ser da mesma organização da página
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_landing_page_item_organization()
RETURNS TRIGGER AS $$
DECLARE
  lp_org_id UUID;
  prod_org_id UUID;
BEGIN
  SELECT organization_id INTO lp_org_id
  FROM public.landing_pages
  WHERE id = NEW.landing_page_id;

  SELECT organization_id INTO prod_org_id
  FROM public.products
  WHERE id = NEW.product_id;

  IF lp_org_id IS NULL OR prod_org_id IS NULL THEN
    RAISE EXCEPTION 'Landing page ou produto não encontrado';
  END IF;

  IF lp_org_id != prod_org_id THEN
    RAISE EXCEPTION 'O produto deve pertencer à mesma organização da landing page';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_landing_page_item_organization_trigger ON public.landing_page_items;
CREATE TRIGGER check_landing_page_item_organization_trigger
  BEFORE INSERT OR UPDATE OF product_id, landing_page_id
  ON public.landing_page_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_landing_page_item_organization();

COMMENT ON FUNCTION public.check_landing_page_item_organization() IS
  'Garante multi-empresa: item da landing page só pode referenciar produto da mesma organização';

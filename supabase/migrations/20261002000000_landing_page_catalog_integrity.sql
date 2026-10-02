-- Landing page: catálogo vem do estoque (Hetzner). Fecha leitura pública ampla no Supabase.

ALTER TABLE public.landing_page_items
  DROP CONSTRAINT IF EXISTS landing_page_items_product_id_fkey;

DROP TRIGGER IF EXISTS validate_landing_page_item_product_trigger ON public.landing_page_items;
DROP TRIGGER IF EXISTS check_landing_page_item_organization_trigger ON public.landing_page_items;

CREATE OR REPLACE FUNCTION public.validate_landing_page_item_product()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_landing_page_item_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_landing_page_item_product() IS
  'Validação de produto/organização ficou na edge function landing-page-items, contra o estoque.';

CREATE OR REPLACE FUNCTION public.check_landing_page_lead_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lead_count INTEGER;
BEGIN
  IF NEW.ip_address IS NULL OR btrim(NEW.ip_address) = '' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO lead_count
  FROM public.landing_page_leads
  WHERE ip_address = NEW.ip_address
    AND created_at > now() - INTERVAL '1 hour';

  IF lead_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: máximo de 5 leads por hora por IP. Tente novamente mais tarde.';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users can view landing pages of their organization" ON public.landing_pages;
CREATE POLICY "Users can view landing pages of their organization"
  ON public.landing_pages FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Public can view products for active landing pages" ON public.products;
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
CREATE POLICY "Users can view products of their organization"
  ON public.products FOR SELECT
  USING (
    (
      auth.uid() IS NOT NULL
      AND organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view landing page items" ON public.landing_page_items;
CREATE POLICY "Users can view landing page items"
  ON public.landing_page_items FOR SELECT
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
  );

DROP POLICY IF EXISTS "Public can create landing page leads" ON public.landing_page_leads;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.diagnose_landing_page_issues() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.diagnose_landing_page_organization_sync() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.diagnose_landing_page_simple() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.check_product_visibility(UUID, UUID) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Uso real dos módulos: uma linha por empresa + módulo, atualizada no máximo a cada 6 horas.

CREATE TABLE IF NOT EXISTS public.organization_module_usage (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature text NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, feature)
);

CREATE INDEX IF NOT EXISTS organization_module_usage_org_used_idx
  ON public.organization_module_usage (organization_id, last_used_at DESC);

ALTER TABLE public.organization_module_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_module_use(_organization_id uuid, _feature text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR _organization_id IS NULL OR _feature IS NULL OR length(_feature) > 80 THEN
    RETURN;
  END IF;

  IF _feature NOT IN (
    'leads', 'post_sale', 'call_queue', 'calendar', 'broadcast', 'automations',
    'form_builder', 'contracts', 'budgets', 'pos', 'nota_fiscal', 'service_orders',
    'finance', 'reports', 'employees', 'landing_page', 'wordpress_content',
    'scheduled_messages', 'whatsapp_messages'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _organization_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) AND NOT COALESCE(public.is_pubdigital_user(auth.uid()), false) THEN
    RETURN;
  END IF;

  INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
  VALUES (_organization_id, _feature, now())
  ON CONFLICT (organization_id, feature) DO UPDATE
  SET last_used_at = EXCLUDED.last_used_at
  WHERE organization_module_usage.last_used_at < now() - interval '6 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_list_module_usage(_org_id uuid)
RETURNS TABLE (feature text, last_used_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.superadmin_assert();
  RETURN QUERY
  SELECT usage.feature, usage.last_used_at
  FROM public.organization_module_usage usage
  WHERE usage.organization_id = _org_id
  ORDER BY usage.last_used_at DESC
  LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.record_module_use(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_list_module_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_module_use(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_list_module_usage(uuid) TO authenticated;

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'leads', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.leads WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'call_queue', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.call_queue WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'budgets', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.budgets WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'service_orders', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.service_orders WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'finance', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.financial_entries WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'contracts', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.contracts WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'form_builder', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.form_builders WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'post_sale', max(created_at)
FROM public.post_sale_activities WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'calendar', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.calendar_events WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'scheduled_messages', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.scheduled_messages WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'broadcast', max(created_at)
FROM public.broadcast_campaigns WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

INSERT INTO public.organization_module_usage (organization_id, feature, last_used_at)
SELECT organization_id, 'landing_page', max(GREATEST(created_at, COALESCE(updated_at, created_at)))
FROM public.landing_pages WHERE organization_id IS NOT NULL GROUP BY organization_id
ON CONFLICT (organization_id, feature) DO UPDATE
SET last_used_at = GREATEST(organization_module_usage.last_used_at, EXCLUDED.last_used_at);

-- Últimos módulos usados só quando o super admin abre uma empresa.
-- A consulta lê a última atividade já gravada naquela empresa. Não há gravação ao navegar.

CREATE OR REPLACE FUNCTION public.superadmin_list_module_usage(_org_id uuid)
RETURNS TABLE (feature text, last_used_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.superadmin_assert();

  RETURN QUERY
  SELECT activity.feature, activity.last_used_at
  FROM (
    SELECT 'leads'::text AS feature, max(GREATEST(created_at, COALESCE(updated_at, created_at))) AS last_used_at
    FROM public.leads WHERE organization_id = _org_id
    UNION ALL
    SELECT 'call_queue'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.call_queue WHERE organization_id = _org_id
    UNION ALL
    SELECT 'budgets'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.budgets WHERE organization_id = _org_id
    UNION ALL
    SELECT 'service_orders'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.service_orders WHERE organization_id = _org_id
    UNION ALL
    SELECT 'finance'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.financial_entries WHERE organization_id = _org_id
    UNION ALL
    SELECT 'contracts'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.contracts WHERE organization_id = _org_id
    UNION ALL
    SELECT 'form_builder'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.form_builders WHERE organization_id = _org_id
    UNION ALL
    SELECT 'post_sale'::text, max(created_at)
    FROM public.post_sale_activities WHERE organization_id = _org_id
    UNION ALL
    SELECT 'calendar'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.calendar_events WHERE organization_id = _org_id
    UNION ALL
    SELECT 'scheduled_messages'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.scheduled_messages WHERE organization_id = _org_id
    UNION ALL
    SELECT 'broadcast'::text, max(created_at)
    FROM public.broadcast_campaigns WHERE organization_id = _org_id
    UNION ALL
    SELECT 'landing_page'::text, max(GREATEST(created_at, COALESCE(updated_at, created_at)))
    FROM public.landing_pages WHERE organization_id = _org_id
  ) activity
  WHERE activity.last_used_at IS NOT NULL
  ORDER BY activity.last_used_at DESC
  LIMIT 5;
END;
$$;

DROP FUNCTION IF EXISTS public.record_module_use(uuid, text);
DROP TABLE IF EXISTS public.organization_module_usage;

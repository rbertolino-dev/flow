-- RPC agregada: enriquecimento do funil em 1 round-trip (tags, assignees, activities, budgets, anexos).
CREATE OR REPLACE FUNCTION public.enrich_leads_for_funnel(
  p_organization_id uuid,
  p_lead_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF NOT (
    public.user_belongs_to_org(auth.uid(), p_organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RETURN '{}'::jsonb;
  END IF;

  IF p_lead_ids IS NULL OR array_length(p_lead_ids, 1) IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'activities', COALESCE((
      SELECT jsonb_object_agg(lead_id, acts)
      FROM (
        SELECT a.lead_id, jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'lead_id', a.lead_id,
            'type', a.type,
            'content', a.content,
            'created_at', a.created_at,
            'user_name', a.user_name
          ) ORDER BY a.created_at DESC
        ) AS acts
        FROM (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY created_at DESC) AS rn
          FROM public.activities
          WHERE lead_id = ANY(p_lead_ids)
        ) a
        WHERE a.rn <= 5
        GROUP BY a.lead_id
      ) sub
    ), '{}'::jsonb),
    'tags', COALESCE((
      SELECT jsonb_object_agg(lead_id, tag_rows)
      FROM (
        SELECT lt.lead_id, jsonb_agg(
          jsonb_build_object(
            'lead_id', lt.lead_id,
            'tag_id', lt.tag_id,
            'tags', jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
          )
        ) AS tag_rows
        FROM public.lead_tags lt
        JOIN public.tags t ON t.id = lt.tag_id
        WHERE lt.lead_id = ANY(p_lead_ids)
        GROUP BY lt.lead_id
      ) sub
    ), '{}'::jsonb),
    'assignees', COALESCE((
      SELECT jsonb_object_agg(lead_id, assignee_rows)
      FROM (
        SELECT la.lead_id, jsonb_agg(
          jsonb_build_object(
            'lead_id', la.lead_id,
            'user_id', la.user_id,
            'created_at', la.created_at,
            'full_name', p.full_name,
            'email', p.email
          ) ORDER BY la.created_at ASC
        ) AS assignee_rows
        FROM public.lead_assignees la
        LEFT JOIN public.profiles p ON p.id = la.user_id
        WHERE la.lead_id = ANY(p_lead_ids)
        GROUP BY la.lead_id
      ) sub
    ), '{}'::jsonb),
    'budget_rows', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'lead_id', b.lead_id,
          'budget_number', b.budget_number,
          'total', b.total,
          'created_at', b.created_at,
          'expires_at', b.expires_at,
          'approved', b.approved,
          'rejected', COALESCE(b.rejected, false)
        )
      )
      FROM public.budgets b
      WHERE b.organization_id = p_organization_id
        AND b.lead_id = ANY(p_lead_ids)
    ), '[]'::jsonb),
    'attachment_counts', COALESCE((
      SELECT jsonb_object_agg(lead_id, cnt)
      FROM (
        SELECT la.lead_id, COUNT(*)::bigint AS cnt
        FROM public.lead_attachments la
        WHERE la.organization_id = p_organization_id
          AND la.lead_id = ANY(p_lead_ids)
        GROUP BY la.lead_id
      ) sub
    ), '{}'::jsonb)
  ) INTO result;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.enrich_leads_for_funnel(uuid, uuid[]) IS
  'Enriquecimento agregado do funil: tags, assignees, activities (5/lead), budgets e anexos.';

GRANT EXECUTE ON FUNCTION public.enrich_leads_for_funnel(uuid, uuid[]) TO authenticated;

-- Índices idempotentes para escala (Fase 4.3)
CREATE INDEX IF NOT EXISTS idx_leads_org_stage_deleted
  ON public.leads (organization_id, stage_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lead_tags_lead_id
  ON public.lead_tags (lead_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_org_lead_status
  ON public.scheduled_messages (organization_id, lead_id, status);

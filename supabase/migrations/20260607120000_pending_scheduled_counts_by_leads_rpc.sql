-- RPC agregada: contagens de scheduled_messages pendentes por lead (1 round-trip).
CREATE OR REPLACE FUNCTION public.pending_scheduled_counts_by_leads(
  p_organization_id uuid,
  p_lead_ids uuid[]
)
RETURNS TABLE(lead_id uuid, pending_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.user_belongs_to_org(auth.uid(), p_organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RETURN;
  END IF;

  IF p_lead_ids IS NULL OR array_length(p_lead_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sm.lead_id,
    COUNT(*)::bigint AS pending_count
  FROM public.scheduled_messages sm
  WHERE sm.organization_id = p_organization_id
    AND sm.status = 'pending'
    AND sm.lead_id = ANY(p_lead_ids)
  GROUP BY sm.lead_id;
END;
$$;

COMMENT ON FUNCTION public.pending_scheduled_counts_by_leads(uuid, uuid[]) IS
  'Contagens de mensagens agendadas pendentes por lead_id para badges no funil.';

GRANT EXECUTE ON FUNCTION public.pending_scheduled_counts_by_leads(uuid, uuid[]) TO authenticated;

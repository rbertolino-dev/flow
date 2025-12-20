-- Fix add_to_call_queue_secure to use the lead's organization and validate membership correctly
DROP FUNCTION IF EXISTS public.add_to_call_queue_secure(uuid, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamptz,
  p_priority text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_lead_org_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Fetch lead organization
  SELECT organization_id INTO v_lead_org_id
  FROM leads
  WHERE id = p_lead_id AND deleted_at IS NULL;

  IF v_lead_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Validate that the user can act on the lead's organization
  IF NOT (
    public.user_belongs_to_org(v_user_id, v_lead_org_id)
    OR public.has_role(v_user_id, 'admin'::app_role)
    OR public.is_pubdigital_user(v_user_id)
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização do lead';
  END IF;

  -- Prevent duplicates (pending/rescheduled) scoped to the same organization
  SELECT id INTO v_existing_id
  FROM call_queue
  WHERE lead_id = p_lead_id
    AND organization_id = v_lead_org_id
    AND status IN ('pending', 'rescheduled')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já está na fila com status ativo';
  END IF;

  -- Insert with the lead's organization_id
  INSERT INTO call_queue (
    lead_id,
    organization_id,
    scheduled_for,
    priority,
    notes,
    status,
    created_by,
    updated_by
  ) VALUES (
    p_lead_id,
    v_lead_org_id,
    p_scheduled_for,
    p_priority,
    p_notes,
    'pending',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO anon;
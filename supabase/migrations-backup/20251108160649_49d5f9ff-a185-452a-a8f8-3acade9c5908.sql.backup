-- 1) Harden Evolution integration with a per-config secret and uniqueness
-- Add webhook_secret to evolution_config
ALTER TABLE public.evolution_config
ADD COLUMN IF NOT EXISTS webhook_secret uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS ux_evolution_config_webhook_secret
ON public.evolution_config (webhook_secret);

-- Optional uniqueness per organization to reduce ambiguity
CREATE UNIQUE INDEX IF NOT EXISTS ux_evolution_config_instance_org
ON public.evolution_config (instance_name, organization_id);

-- 2) Secure RPC for creating leads that bypasses RLS but enforces org membership
CREATE OR REPLACE FUNCTION public.create_lead_secure(
  p_org_id uuid,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_value numeric DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'manual'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_assigned_to text;
  v_stage_exists boolean;
  v_lead_id uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- verify membership in organization
  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
  END IF;

  -- validate stage belongs to same org when provided
  IF p_stage_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.pipeline_stages 
      WHERE id = p_stage_id AND organization_id = p_org_id
    ) INTO v_stage_exists;
    IF NOT v_stage_exists THEN
      RAISE EXCEPTION 'Etapa inválida para a organização';
    END IF;
  END IF;

  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    source, status, assigned_to, notes, stage_id, last_contact, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, p_phone, p_email, p_company, p_value,
    p_source, 'new', COALESCE(v_assigned_to, 'Sistema'), p_notes, p_stage_id, NOW(), NOW(), NOW()
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;
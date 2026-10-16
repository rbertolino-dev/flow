-- API pública v1: chaves por organização + logs + criação de lead via API

CREATE TABLE IF NOT EXISTS public.organization_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[
    'leads:read'::text,
    'leads:write'::text,
    'stages:read'::text,
    'tags:read'::text
  ],
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_api_keys_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT organization_api_keys_prefix_not_empty CHECK (char_length(trim(key_prefix)) > 0),
  CONSTRAINT organization_api_keys_hash_not_empty CHECK (char_length(trim(key_hash)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_api_keys_hash
  ON public.organization_api_keys (key_hash);

CREATE INDEX IF NOT EXISTS idx_organization_api_keys_org
  ON public.organization_api_keys (organization_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_organization_api_keys_prefix
  ON public.organization_api_keys (key_prefix);

COMMENT ON TABLE public.organization_api_keys IS
  'API keys por organização para a API pública v1. O secret completo nunca é armazenado.';

CREATE TABLE IF NOT EXISTS public.organization_api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.organization_api_keys(id) ON DELETE SET NULL,
  method text NOT NULL,
  path text NOT NULL,
  status integer NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_api_request_logs_key_created
  ON public.organization_api_request_logs (api_key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_organization_api_request_logs_org_created
  ON public.organization_api_request_logs (organization_id, created_at DESC);

COMMENT ON TABLE public.organization_api_request_logs IS
  'Auditoria leve de chamadas à API pública v1 (sem UI na v1).';

ALTER TABLE public.organization_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_api_admin(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.organization_id = p_organization_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.is_org_api_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_api_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS organization_api_keys_select ON public.organization_api_keys;
CREATE POLICY organization_api_keys_select ON public.organization_api_keys
  FOR SELECT USING (public.is_org_api_admin(organization_id));

DROP POLICY IF EXISTS organization_api_keys_insert ON public.organization_api_keys;
CREATE POLICY organization_api_keys_insert ON public.organization_api_keys
  FOR INSERT WITH CHECK (public.is_org_api_admin(organization_id));

DROP POLICY IF EXISTS organization_api_keys_update ON public.organization_api_keys;
CREATE POLICY organization_api_keys_update ON public.organization_api_keys
  FOR UPDATE
  USING (public.is_org_api_admin(organization_id))
  WITH CHECK (public.is_org_api_admin(organization_id));

DROP POLICY IF EXISTS organization_api_keys_delete ON public.organization_api_keys;
CREATE POLICY organization_api_keys_delete ON public.organization_api_keys
  FOR DELETE USING (public.is_org_api_admin(organization_id));

DROP POLICY IF EXISTS organization_api_request_logs_select ON public.organization_api_request_logs;
CREATE POLICY organization_api_request_logs_select ON public.organization_api_request_logs
  FOR SELECT USING (public.is_org_api_admin(organization_id));

CREATE OR REPLACE FUNCTION public.create_lead_via_api(
  p_org_id uuid,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_value numeric DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'api'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid;
  v_assigned_to text;
  v_stage_exists boolean;
  v_lead_id uuid;
  v_norm_phone text;
  v_existing_lead_id uuid;
  v_existing_excluded boolean;
  v_can_create boolean;
  v_allow_dupes boolean := false;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório';
  END IF;

  IF p_name IS NULL OR char_length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'name é obrigatório';
  END IF;

  IF p_phone IS NULL OR char_length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'phone é obrigatório';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organização inválida';
  END IF;

  BEGIN
    SELECT public.can_create_lead(p_org_id) INTO v_can_create;
    IF NOT v_can_create THEN
      RAISE EXCEPTION 'Limite de leads excedido para esta organização';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  v_norm_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF char_length(v_norm_phone) = 0 THEN
    RAISE EXCEPTION 'phone inválido';
  END IF;

  SELECT COALESCE(s.allow_duplicate_phones, false)
  INTO v_allow_dupes
  FROM public.organization_crm_settings s
  WHERE s.organization_id = p_org_id;

  IF NOT FOUND THEN
    v_allow_dupes := false;
  END IF;

  IF NOT v_allow_dupes THEN
    BEGIN
      SELECT id, COALESCE(excluded_from_funnel, false)
      INTO v_existing_lead_id, v_existing_excluded
      FROM public.leads
      WHERE organization_id = p_org_id
        AND phone = v_norm_phone
        AND deleted_at IS NULL
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      SELECT id INTO v_existing_lead_id
      FROM public.leads
      WHERE organization_id = p_org_id
        AND phone = v_norm_phone
        AND deleted_at IS NULL
      LIMIT 1;
      v_existing_excluded := false;
    END;

    IF v_existing_lead_id IS NOT NULL AND v_existing_excluded = true THEN
      RETURN v_existing_lead_id;
    END IF;

    IF v_existing_lead_id IS NOT NULL THEN
      RAISE EXCEPTION 'Lead com este telefone já existe na organização';
    END IF;
  END IF;

  IF p_stage_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.pipeline_stages
      WHERE id = p_stage_id AND organization_id = p_org_id
    ) INTO v_stage_exists;
    IF NOT v_stage_exists THEN
      RAISE EXCEPTION 'Etapa inválida para a organização';
    END IF;
  END IF;

  SELECT om.user_id INTO v_user
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      ELSE 2
    END,
    om.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Organização sem membros para atribuir o lead';
  END IF;

  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    stage_id, notes, source, assigned_to, status, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, trim(p_name), v_norm_phone, p_email, p_company, p_value,
    p_stage_id, p_notes, COALESCE(NULLIF(trim(p_source), ''), 'api'),
    COALESCE(v_assigned_to, 'API'), 'new', NOW(), NOW()
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$func$;

COMMENT ON FUNCTION public.create_lead_via_api IS
  'Cria lead via API pública (sem auth.uid). Isolado por organization_id; respeita dedupe e limites.';

REVOKE ALL ON FUNCTION public.create_lead_via_api(
  uuid, text, text, text, text, numeric, uuid, text, text
) FROM PUBLIC;

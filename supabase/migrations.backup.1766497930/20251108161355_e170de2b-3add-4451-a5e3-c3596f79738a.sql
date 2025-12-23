-- 1) Drop wrong unique constraint (user_id, phone) and enforce org-level uniqueness
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_user_phone_unique;

-- 2) Ensure phone normalization at DB-level to avoid duplicates with formatting
CREATE OR REPLACE FUNCTION public.normalize_lead_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '\\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_lead_phone_ins ON public.leads;
DROP TRIGGER IF EXISTS trg_normalize_lead_phone_upd ON public.leads;
CREATE TRIGGER trg_normalize_lead_phone_ins
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_lead_phone();
CREATE TRIGGER trg_normalize_lead_phone_upd
BEFORE UPDATE OF phone ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_lead_phone();

-- 3) Unique index by organization + phone for active (not soft-deleted) leads
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_org_phone_active
ON public.leads (organization_id, phone)
WHERE deleted_at IS NULL;

-- 4) Harden create_lead_secure: normalize and deduplicate within organization
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
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
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

  v_norm_phone := regexp_replace(coalesce(p_phone,''), '\\D', '', 'g');

  -- Return existing active lead if already present in the org
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE organization_id = p_org_id
    AND deleted_at IS NULL
    AND phone = v_norm_phone
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    RETURN v_lead_id;
  END IF;

  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    source, status, assigned_to, notes, stage_id, last_contact, created_at, updated_at, created_by, updated_by
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
    p_source, 'new', COALESCE(v_assigned_to, 'Sistema'), p_notes, p_stage_id, NOW(), NOW(), NOW(), v_user, v_user
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$func$;
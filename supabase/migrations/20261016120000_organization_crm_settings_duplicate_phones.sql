-- Preferência por organização: permitir leads com o mesmo telefone (default: false)
-- Enforcement via phone_dedupe_key + índice único parcial (à prova de corrida)

-- 1) Tabela de configurações do CRM
CREATE TABLE IF NOT EXISTS public.organization_crm_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  allow_duplicate_phones BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.organization_crm_settings IS
  'Preferências do CRM por organização (ex.: permitir telefones duplicados no funil)';
COMMENT ON COLUMN public.organization_crm_settings.allow_duplicate_phones IS
  'Se true, permite mais de um lead ativo com o mesmo telefone na organização. Default false (unicidade).';

ALTER TABLE public.organization_crm_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM settings: members can select" ON public.organization_crm_settings;
CREATE POLICY "CRM settings: members can select"
  ON public.organization_crm_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_crm_settings.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), organization_crm_settings.organization_id)
  );

DROP POLICY IF EXISTS "CRM settings: admins can insert" ON public.organization_crm_settings;
CREATE POLICY "CRM settings: admins can insert"
  ON public.organization_crm_settings
  FOR INSERT
  WITH CHECK (
    public.user_is_org_admin(auth.uid(), organization_crm_settings.organization_id)
  );

DROP POLICY IF EXISTS "CRM settings: admins can update" ON public.organization_crm_settings;
CREATE POLICY "CRM settings: admins can update"
  ON public.organization_crm_settings
  FOR UPDATE
  USING (
    public.user_is_org_admin(auth.uid(), organization_crm_settings.organization_id)
  )
  WITH CHECK (
    public.user_is_org_admin(auth.uid(), organization_crm_settings.organization_id)
  );

-- 2) Coluna phone_dedupe_key em leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone_dedupe_key text;

-- Backfill: telefone normalizado; vazios usam id; duplicatas históricas extras usam id
UPDATE public.leads
SET phone_dedupe_key = CASE
  WHEN phone IS NULL OR btrim(phone) = '' THEN id::text
  ELSE regexp_replace(phone, '\D', '', 'g')
END
WHERE phone_dedupe_key IS NULL;

-- Duplicatas ativas: manter a mais antiga com chave = phone; demais com chave = id
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.leads
  WHERE deleted_at IS NULL
    AND phone IS NOT NULL
    AND btrim(phone) <> ''
)
UPDATE public.leads l
SET phone_dedupe_key = l.id::text
FROM ranked r
WHERE l.id = r.id
  AND r.rn > 1;

UPDATE public.leads
SET phone_dedupe_key = id::text
WHERE phone_dedupe_key IS NULL OR phone_dedupe_key = '';

ALTER TABLE public.leads
  ALTER COLUMN phone_dedupe_key SET NOT NULL;

COMMENT ON COLUMN public.leads.phone_dedupe_key IS
  'Chave de unicidade: igual ao phone quando a org exige telefone único; igual ao id quando duplicatas são permitidas';

-- 3) Novo índice único; remove o antigo (organization_id, phone)
DROP INDEX IF EXISTS public.ux_leads_org_phone_active;

CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_org_phone_dedupe_active
  ON public.leads (organization_id, phone_dedupe_key)
  WHERE deleted_at IS NULL;

-- 4) Trigger: normaliza phone + preenche phone_dedupe_key
CREATE OR REPLACE FUNCTION public.normalize_lead_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow boolean := false;
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '\D', '', 'g');
  END IF;

  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  SELECT COALESCE(s.allow_duplicate_phones, false)
  INTO v_allow
  FROM public.organization_crm_settings s
  WHERE s.organization_id = NEW.organization_id;

  IF NOT FOUND THEN
    v_allow := false;
  END IF;

  IF v_allow THEN
    NEW.phone_dedupe_key := NEW.id::text;
  ELSE
    IF NEW.phone IS NULL OR NEW.phone = '' THEN
      NEW.phone_dedupe_key := NEW.id::text;
    ELSE
      NEW.phone_dedupe_key := NEW.phone;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_lead_phone_ins ON public.leads;
DROP TRIGGER IF EXISTS trg_normalize_lead_phone_upd ON public.leads;

CREATE TRIGGER trg_normalize_lead_phone_ins
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_lead_phone();

CREATE TRIGGER trg_normalize_lead_phone_upd
  BEFORE UPDATE OF phone, organization_id, deleted_at, phone_dedupe_key ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_lead_phone();

-- 5) Validação BEFORE (não desligar com duplicatas) + recálculo AFTER (setting já visível)
CREATE OR REPLACE FUNCTION public.trg_organization_crm_settings_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup_count integer;
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.allow_duplicate_phones = false
     AND OLD.allow_duplicate_phones = true THEN
    SELECT COUNT(*)::integer INTO v_dup_count
    FROM (
      SELECT 1
      FROM public.leads
      WHERE organization_id = NEW.organization_id
        AND deleted_at IS NULL
        AND phone IS NOT NULL
        AND btrim(phone) <> ''
      GROUP BY phone
      HAVING COUNT(*) > 1
    ) d;

    IF v_dup_count > 0 THEN
      RAISE EXCEPTION
        'Não é possível desativar telefones duplicados: existem % telefone(s) com mais de um lead ativo. Consolide ou archive os leads antes.',
        v_dup_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_organization_crm_settings_after_phone_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (
    TG_OP = 'UPDATE'
    AND NEW.allow_duplicate_phones IS DISTINCT FROM OLD.allow_duplicate_phones
  ) THEN
    IF NEW.allow_duplicate_phones THEN
      UPDATE public.leads
      SET phone_dedupe_key = id::text
      WHERE organization_id = NEW.organization_id
        AND deleted_at IS NULL;
    ELSE
      UPDATE public.leads
      SET phone_dedupe_key = CASE
        WHEN phone IS NULL OR btrim(phone) = '' THEN id::text
        ELSE regexp_replace(phone, '\D', '', 'g')
      END
      WHERE organization_id = NEW.organization_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_crm_settings_phone_policy ON public.organization_crm_settings;
DROP TRIGGER IF EXISTS trg_org_crm_settings_before ON public.organization_crm_settings;
DROP TRIGGER IF EXISTS trg_org_crm_settings_after_phone_keys ON public.organization_crm_settings;

CREATE TRIGGER trg_org_crm_settings_before
  BEFORE INSERT OR UPDATE ON public.organization_crm_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_organization_crm_settings_before();

CREATE TRIGGER trg_org_crm_settings_after_phone_keys
  AFTER INSERT OR UPDATE ON public.organization_crm_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_organization_crm_settings_after_phone_keys();

-- 6) create_lead_secure: respeita allow_duplicate_phones (mantém comportamento atual da produção)
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
  v_existing_lead_id uuid;
  v_existing_excluded boolean;
  v_can_create boolean;
  v_allow_dupes boolean := false;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
  END IF;

  BEGIN
    SELECT public.can_create_lead(p_org_id) INTO v_can_create;
    IF NOT v_can_create THEN
      RAISE EXCEPTION 'Limite de leads excedido para esta organização. Entre em contato com o administrador.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  v_norm_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

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

  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    stage_id, notes, source, assigned_to, status, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
    p_stage_id, p_notes, p_source, COALESCE(v_assigned_to, 'Sistema'), 'new', NOW(), NOW()
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$func$;

COMMENT ON FUNCTION public.create_lead_secure IS
  'Cria lead com validação de limites; bloqueia telefone duplicado salvo se organization_crm_settings.allow_duplicate_phones = true';

GRANT EXECUTE ON FUNCTION public.create_lead_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_lead_secure TO anon;

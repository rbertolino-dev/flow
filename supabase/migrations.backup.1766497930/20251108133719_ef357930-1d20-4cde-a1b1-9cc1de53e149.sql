-- Garantir que todo novo lead receba organization_id automaticamente
CREATE OR REPLACE FUNCTION public.set_lead_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  -- Se já vier preenchido, não altera
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Escolher o usuário base para descobrir a organização
  v_user := COALESCE(NEW.created_by, NEW.user_id, auth.uid());

  SELECT om.organization_id INTO v_org
  FROM public.organization_members om
  WHERE om.user_id = v_user
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário % não possui organização para atribuir ao lead', v_user;
  END IF;

  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_lead_organization ON public.leads;
CREATE TRIGGER trg_set_lead_organization
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.set_lead_organization();
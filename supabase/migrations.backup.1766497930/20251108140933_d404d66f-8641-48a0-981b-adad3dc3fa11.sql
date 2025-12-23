-- Tornar organization_id NOT NULL em todas as tabelas principais

ALTER TABLE tags 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE message_templates 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE evolution_config 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE leads 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE call_queue 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE activities 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE scheduled_messages 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE broadcast_campaigns 
  ALTER COLUMN organization_id SET NOT NULL;

-- Criar função genérica para garantir organization_id
CREATE OR REPLACE FUNCTION public.ensure_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  -- Se já tem organization_id, não fazer nada
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tentar pegar do user_id ou created_by
  v_user := COALESCE(NEW.user_id, NEW.created_by, auth.uid());
  
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não foi possível determinar o usuário para atribuir organização';
  END IF;

  -- Buscar organização do usuário
  SELECT om.organization_id INTO v_org
  FROM public.organization_members om
  WHERE om.user_id = v_user
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário % não pertence a nenhuma organização', v_user;
  END IF;

  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

-- Aplicar trigger em tags
DROP TRIGGER IF EXISTS trg_ensure_org_tags ON public.tags;
CREATE TRIGGER trg_ensure_org_tags
BEFORE INSERT ON public.tags
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em message_templates
DROP TRIGGER IF EXISTS trg_ensure_org_templates ON public.message_templates;
CREATE TRIGGER trg_ensure_org_templates
BEFORE INSERT ON public.message_templates
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em evolution_config
DROP TRIGGER IF EXISTS trg_ensure_org_evolution ON public.evolution_config;
CREATE TRIGGER trg_ensure_org_evolution
BEFORE INSERT ON public.evolution_config
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em call_queue
DROP TRIGGER IF EXISTS trg_ensure_org_call_queue ON public.call_queue;
CREATE TRIGGER trg_ensure_org_call_queue
BEFORE INSERT ON public.call_queue
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em activities
DROP TRIGGER IF EXISTS trg_ensure_org_activities ON public.activities;
CREATE TRIGGER trg_ensure_org_activities
BEFORE INSERT ON public.activities
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em broadcast_campaigns
DROP TRIGGER IF EXISTS trg_ensure_org_campaigns ON public.broadcast_campaigns;
CREATE TRIGGER trg_ensure_org_campaigns
BEFORE INSERT ON public.broadcast_campaigns
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();
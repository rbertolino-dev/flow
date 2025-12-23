-- Criar função para garantir etapas padrão para uma organização
CREATE OR REPLACE FUNCTION public.ensure_org_has_pipeline_stages(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _first_user_id UUID;
BEGIN
  -- Verificar se a organização já tem etapas
  IF EXISTS (SELECT 1 FROM pipeline_stages WHERE organization_id = _org_id) THEN
    RETURN;
  END IF;

  -- Pegar o primeiro usuário da organização para associar as etapas
  SELECT user_id INTO _first_user_id
  FROM organization_members
  WHERE organization_id = _org_id
  LIMIT 1;

  -- Se não houver usuários, não criar etapas
  IF _first_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Criar etapas padrão
  INSERT INTO public.pipeline_stages (user_id, organization_id, name, color, position)
  VALUES
    (_first_user_id, _org_id, 'Novo Lead', '#10b981', 0),
    (_first_user_id, _org_id, 'Contato Feito', '#3b82f6', 1),
    (_first_user_id, _org_id, 'Proposta Enviada', '#8b5cf6', 2),
    (_first_user_id, _org_id, 'Em Negociação', '#f59e0b', 3),
    (_first_user_id, _org_id, 'Ganho', '#22c55e', 4),
    (_first_user_id, _org_id, 'Perdido', '#ef4444', 5)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Criar trigger para garantir etapas quando organização é criada
CREATE OR REPLACE FUNCTION public.create_pipeline_stages_for_new_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Esperar um pouco para garantir que o membro foi adicionado
  -- (este trigger roda após INSERT em organizations)
  PERFORM public.ensure_org_has_pipeline_stages(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_pipeline_stages_for_org ON public.organizations;
CREATE TRIGGER trg_create_pipeline_stages_for_org
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.create_pipeline_stages_for_new_org();

-- Criar trigger quando primeiro membro é adicionado a uma organização
CREATE OR REPLACE FUNCTION public.create_pipeline_stages_on_first_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garantir que a organização tenha etapas
  PERFORM public.ensure_org_has_pipeline_stages(NEW.organization_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_pipeline_stages_on_member ON public.organization_members;
CREATE TRIGGER trg_create_pipeline_stages_on_member
AFTER INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.create_pipeline_stages_on_first_member();

-- Corrigir organizações existentes sem etapas
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN 
    SELECT DISTINCT o.id
    FROM organizations o
    LEFT JOIN pipeline_stages ps ON ps.organization_id = o.id
    WHERE ps.id IS NULL
  LOOP
    PERFORM public.ensure_org_has_pipeline_stages(org_record.id);
  END LOOP;
END $$;
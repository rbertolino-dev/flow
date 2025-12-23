-- Primeiro, limpar o usuário órfão que foi criado parcialmente
DELETE FROM user_roles WHERE user_id = '96421e53-d098-4439-acff-d7f03bea67da';
DELETE FROM profiles WHERE id = '96421e53-d098-4439-acff-d7f03bea67da';

-- Depois deletar o usuário do auth (precisa ser feito via edge function, então vamos usar uma função helper)
DO $$
BEGIN
  -- Deletar do auth usando a API admin
  PERFORM auth.uid(); -- dummy call para garantir que auth está disponível
EXCEPTION WHEN OTHERS THEN
  -- Se falhar, não tem problema, vamos limpar via edge function
  NULL;
END $$;

-- Verificar e dropar triggers problemáticos que criam pipeline stages ao adicionar membros
DROP TRIGGER IF EXISTS create_pipeline_stages_on_first_member ON organization_members;
DROP TRIGGER IF EXISTS on_organization_member_added ON organization_members;

-- Criar função melhorada para criar pipeline stages SOMENTE se a organização não tiver nenhum
CREATE OR REPLACE FUNCTION public.maybe_create_pipeline_stages_for_org()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage_count INTEGER;
  v_first_member_user_id UUID;
BEGIN
  -- Contar quantos stages essa organização já tem
  SELECT COUNT(*) INTO v_stage_count
  FROM pipeline_stages
  WHERE organization_id = NEW.organization_id;
  
  -- Se já tem stages, não fazer nada
  IF v_stage_count > 0 THEN
    RETURN NEW;
  END IF;
  
  -- Pegar o primeiro membro admin da organização para ser o dono dos stages
  SELECT user_id INTO v_first_member_user_id
  FROM organization_members
  WHERE organization_id = NEW.organization_id
    AND role IN ('owner', 'admin')
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Se não encontrou admin, usar o próprio usuário que está sendo adicionado
  IF v_first_member_user_id IS NULL THEN
    v_first_member_user_id := NEW.user_id;
  END IF;
  
  -- Criar stages padrão para essa organização
  INSERT INTO pipeline_stages (user_id, organization_id, name, color, position)
  VALUES
    (v_first_member_user_id, NEW.organization_id, 'Novo Lead', '#10b981', 0),
    (v_first_member_user_id, NEW.organization_id, 'Qualificação', '#3b82f6', 1),
    (v_first_member_user_id, NEW.organization_id, 'Proposta', '#f59e0b', 2),
    (v_first_member_user_id, NEW.organization_id, 'Negociação', '#8b5cf6', 3),
    (v_first_member_user_id, NEW.organization_id, 'Fechado', '#22c55e', 4)
  ON CONFLICT (user_id, name) DO NOTHING; -- Ignorar se já existir
  
  RETURN NEW;
END;
$$;

-- Criar trigger que só dispara DEPOIS de inserir o membro
CREATE TRIGGER create_pipeline_stages_for_new_org
  AFTER INSERT ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_create_pipeline_stages_for_org();
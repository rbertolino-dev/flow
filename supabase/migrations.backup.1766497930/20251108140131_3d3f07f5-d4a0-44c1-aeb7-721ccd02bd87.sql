-- Adicionar constraint UNIQUE para evitar duplicatas de nome por organização
ALTER TABLE public.pipeline_stages
DROP CONSTRAINT IF EXISTS pipeline_stages_org_name_unique;

ALTER TABLE public.pipeline_stages
ADD CONSTRAINT pipeline_stages_org_name_unique 
UNIQUE (organization_id, name);

-- Corrigir função para evitar criar etapas duplicadas
CREATE OR REPLACE FUNCTION public.ensure_org_has_pipeline_stages(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _first_user_id UUID;
  _stage_names TEXT[] := ARRAY['Novo Lead', 'Contato Feito', 'Proposta Enviada', 'Em Negociação', 'Ganho', 'Perdido'];
  _stage_colors TEXT[] := ARRAY['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'];
  _stage_name TEXT;
  _stage_color TEXT;
  _position INT;
BEGIN
  -- Pegar o primeiro usuário da organização para associar as etapas
  SELECT user_id INTO _first_user_id
  FROM organization_members
  WHERE organization_id = _org_id
  LIMIT 1;

  -- Se não houver usuários, não criar etapas
  IF _first_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Criar cada etapa apenas se não existir com o mesmo nome
  FOR _position IN 0..5 LOOP
    _stage_name := _stage_names[_position + 1];
    _stage_color := _stage_colors[_position + 1];
    
    -- Inserir apenas se não existir etapa com este nome nesta organização
    INSERT INTO public.pipeline_stages (user_id, organization_id, name, color, position)
    VALUES (_first_user_id, _org_id, _stage_name, _stage_color, _position)
    ON CONFLICT (organization_id, name) DO NOTHING;
  END LOOP;
END;
$$;
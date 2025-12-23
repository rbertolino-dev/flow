-- Função para verificar se a organização pode criar uma nova instância Evolution
CREATE OR REPLACE FUNCTION public.can_create_evolution_instance(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_limits RECORD;
  current_count INTEGER;
BEGIN
  -- Buscar limites da organização
  SELECT * INTO org_limits
  FROM organization_limits
  WHERE organization_id = _org_id;
  
  -- Se não existe registro, não pode criar
  IF org_limits IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se a feature evolution_instances está habilitada
  IF NOT ('evolution_instances' = ANY(org_limits.enabled_features)) THEN
    RETURN FALSE;
  END IF;
  
  -- Contar instâncias atuais da organização
  SELECT COUNT(*) INTO current_count
  FROM evolution_config
  WHERE organization_id = _org_id;
  
  -- Se max_instances é NULL, sem limite
  IF org_limits.max_instances IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se está dentro do limite
  RETURN current_count < org_limits.max_instances;
END;
$$;
-- Criar função can_create_evolution_instance
-- Esta função verifica se a organização pode criar uma nova instância Evolution

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
  
  -- Se não existe registro, permitir (compatibilidade - organizações antigas)
  IF org_limits IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se a feature evolution_instances está habilitada (usando array de enums)
  -- enabled_features é organization_feature[] (array de enums), não JSONB
  -- Se enabled_features está vazio ou NULL, permitir (compatibilidade)
  -- Se enabled_features tem valores, verificar se evolution_instances está presente
  IF org_limits.enabled_features IS NOT NULL AND 
     array_length(org_limits.enabled_features, 1) IS NOT NULL AND
     array_length(org_limits.enabled_features, 1) > 0 THEN
    -- Se há features definidas, verificar se evolution_instances está presente
    IF NOT ('evolution_instances'::public.organization_feature = ANY(org_limits.enabled_features)) THEN
      RETURN FALSE;
    END IF;
  END IF;
  -- Se enabled_features está vazio/NULL, permitir (compatibilidade)
  
  -- Contar instâncias atuais da organização
  SELECT COUNT(*) INTO current_count
  FROM evolution_config
  WHERE organization_id = _org_id;
  
  -- Verificar limite (usar max_evolution_instances se disponível, senão max_instances)
  -- Se max_evolution_instances é NULL, verificar max_instances
  -- Se ambos são NULL, sem limite (permitir)
  IF org_limits.max_evolution_instances IS NULL THEN
    -- Tentar usar max_instances se existir
    IF org_limits.max_instances IS NULL THEN
      -- Sem limite definido
      RETURN TRUE;
    ELSE
      -- Usar max_instances
      RETURN current_count < org_limits.max_instances;
    END IF;
  ELSE
    -- Usar max_evolution_instances
    RETURN current_count < org_limits.max_evolution_instances;
  END IF;
END;
$$;

-- Comentário para documentação
COMMENT ON FUNCTION public.can_create_evolution_instance(UUID) IS 'Verifica se a organização pode criar uma nova instância Evolution baseado nos limites configurados';


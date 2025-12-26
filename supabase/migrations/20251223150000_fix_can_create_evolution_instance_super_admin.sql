-- Fix: Adicionar suporte a super admin na função can_create_evolution_instance
-- Super admins podem criar instâncias independentemente dos limites

CREATE OR REPLACE FUNCTION public.can_create_evolution_instance(
  _org_id UUID,
  _user_id UUID DEFAULT NULL  -- NOVO: recebe userId para verificar super admin
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_limits RECORD;
  current_count INTEGER;
  is_super_admin BOOLEAN := FALSE;
BEGIN
  -- NOVO: Se userId foi passado, verificar se é super admin
  IF _user_id IS NOT NULL THEN
    -- Verificar se é admin ou pubdigital
    SELECT 
      public.has_role(_user_id, 'admin'::app_role) OR 
      public.is_pubdigital_user(_user_id)
    INTO is_super_admin;
    
    -- Se for super admin, PERMITIR imediatamente (ignora todos os limites)
    IF is_super_admin THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Resto da função continua igual (verificação normal para usuários não-admin)
  SELECT * INTO org_limits
  FROM organization_limits
  WHERE organization_id = _org_id;
  
  -- Se não existe registro, permitir (compatibilidade - organizações antigas)
  IF org_limits IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se a feature evolution_instances está habilitada (usando array de enums)
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
  IF org_limits.max_evolution_instances IS NULL THEN
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
COMMENT ON FUNCTION public.can_create_evolution_instance(UUID, UUID) IS 
'Verifica se a organização pode criar uma nova instância Evolution baseado nos limites configurados. Super admins podem criar independentemente dos limites.';


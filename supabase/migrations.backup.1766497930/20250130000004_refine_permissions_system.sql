-- ============================================
-- MIGRAÇÃO: Refinamento do Sistema de Permissões
-- ============================================
-- Integra permissões com funcionalidades do plano e melhora controle por organização

-- Função para verificar se uma permissão está relacionada a uma funcionalidade do plano
CREATE OR REPLACE FUNCTION public.permission_to_feature(_permission app_permission)
RETURNS public.organization_feature
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result public.organization_feature;
BEGIN
  -- Mapear permissões para funcionalidades do plano
  CASE _permission
    WHEN 'view_leads' THEN v_result := 'leads'::public.organization_feature;
    WHEN 'create_leads' THEN v_result := 'leads'::public.organization_feature;
    WHEN 'edit_leads' THEN v_result := 'leads'::public.organization_feature;
    WHEN 'delete_leads' THEN v_result := 'leads'::public.organization_feature;
    
    WHEN 'view_whatsapp' THEN v_result := 'whatsapp_messages'::public.organization_feature;
    WHEN 'send_whatsapp' THEN v_result := 'whatsapp_messages'::public.organization_feature;
    
    WHEN 'view_broadcast' THEN v_result := 'broadcast'::public.organization_feature;
    WHEN 'create_broadcast' THEN v_result := 'broadcast'::public.organization_feature;
    
    WHEN 'view_call_queue' THEN v_result := 'call_queue'::public.organization_feature;
    WHEN 'manage_call_queue' THEN v_result := 'call_queue'::public.organization_feature;
    
    WHEN 'view_reports' THEN v_result := 'reports'::public.organization_feature;
    
    -- Permissões que não dependem de funcionalidades específicas (sempre disponíveis)
    ELSE v_result := NULL;
  END CASE;
  
  RETURN v_result;
END;
$$;

-- Função para verificar se permissão é válida para a organização (considera plano)
CREATE OR REPLACE FUNCTION public.is_permission_allowed_for_org(
  _permission app_permission,
  _org_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature public.organization_feature;
  v_limits RECORD;
BEGIN
  -- Buscar funcionalidade relacionada à permissão
  v_feature := public.permission_to_feature(_permission);
  
  -- Se não há funcionalidade relacionada, permitir (permissões básicas sempre disponíveis)
  IF v_feature IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Buscar limites e funcionalidades da organização
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Se não há funcionalidades definidas, permitir tudo (compatibilidade)
  IF array_length(v_limits.enabled_features, 1) IS NULL OR array_length(v_limits.enabled_features, 1) = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se a funcionalidade está habilitada
  RETURN v_feature = ANY(v_limits.enabled_features);
END;
$$;

-- Função para obter permissões disponíveis para uma organização (filtradas pelo plano)
CREATE OR REPLACE FUNCTION public.get_available_permissions_for_org(_org_id UUID)
RETURNS TABLE(permission app_permission)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_permission_text TEXT;
  v_permissions_array TEXT[] := ARRAY[
    'view_leads', 'create_leads', 'edit_leads', 'delete_leads',
    'view_call_queue', 'manage_call_queue',
    'view_broadcast', 'create_broadcast',
    'view_whatsapp', 'send_whatsapp',
    'view_templates', 'manage_templates',
    'view_pipeline', 'manage_pipeline',
    'view_settings', 'manage_settings',
    'manage_users', 'view_reports'
  ];
BEGIN
  -- Buscar limites e funcionalidades da organização
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Iterar sobre todas as permissões
  FOREACH v_permission_text IN ARRAY v_permissions_array
  LOOP
    -- Se não há funcionalidades definidas, retornar todas
    IF array_length(v_limits.enabled_features, 1) IS NULL OR array_length(v_limits.enabled_features, 1) = 0 THEN
      permission := v_permission_text::app_permission;
      RETURN NEXT;
    -- Se a permissão é permitida, retornar
    ELSIF public.is_permission_allowed_for_org(v_permission_text::app_permission, _org_id) THEN
      permission := v_permission_text::app_permission;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Trigger para validar permissões ao inserir/atualizar
CREATE OR REPLACE FUNCTION public.validate_user_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_allowed BOOLEAN;
BEGIN
  -- Se organization_id é NULL, permitir (permissão global)
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se a permissão é permitida para a organização
  SELECT public.is_permission_allowed_for_org(NEW.permission, NEW.organization_id) INTO v_is_allowed;
  
  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'A permissão % não está disponível para esta organização. Verifique o plano e funcionalidades habilitadas.', NEW.permission;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_validate_user_permission ON public.user_permissions;
CREATE TRIGGER trg_validate_user_permission
BEFORE INSERT OR UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_permission();

-- Atualizar função has_org_permission para considerar funcionalidades do plano
CREATE OR REPLACE FUNCTION public.has_org_permission(
  _user_id UUID, 
  _permission app_permission,
  _org_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_permission BOOLEAN;
  v_is_allowed BOOLEAN;
BEGIN
  -- Verificar se a permissão está disponível para a organização (plano)
  SELECT public.is_permission_allowed_for_org(_permission, _org_id) INTO v_is_allowed;
  
  IF NOT v_is_allowed THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se o usuário tem a permissão
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND (organization_id = _org_id OR organization_id IS NULL)
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.permission_to_feature(app_permission) IS 'Mapeia uma permissão para sua funcionalidade relacionada no plano';
COMMENT ON FUNCTION public.is_permission_allowed_for_org(app_permission, UUID) IS 'Verifica se uma permissão está disponível para a organização baseado no plano';
COMMENT ON FUNCTION public.get_available_permissions_for_org(UUID) IS 'Retorna lista de permissões disponíveis para uma organização baseado no plano';
COMMENT ON FUNCTION public.validate_user_permission() IS 'Valida se permissão pode ser atribuída considerando funcionalidades do plano';


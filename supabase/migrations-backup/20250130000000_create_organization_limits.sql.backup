-- ============================================
-- MIGRAÇÃO: Limites e Funcionalidades por Organização
-- ============================================
-- Sistema robusto para gerenciar limites de leads, instâncias EVO e funcionalidades por empresa

-- Criar enum para funcionalidades do sistema
CREATE TYPE IF NOT EXISTS public.organization_feature AS ENUM (
  'leads',
  'evolution_instances',
  'broadcast',
  'scheduled_messages',
  'agents',
  'form_builder',
  'facebook_integration',
  'whatsapp_messages',
  'call_queue',
  'reports',
  'api_access'
);

-- Tabela de limites e funcionalidades por organização
CREATE TABLE IF NOT EXISTS public.organization_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Limites numéricos
  max_leads INTEGER DEFAULT NULL, -- NULL = ilimitado
  max_evolution_instances INTEGER DEFAULT NULL, -- NULL = ilimitado
  
  -- Funcionalidades habilitadas (array de enums)
  enabled_features public.organization_feature[] DEFAULT ARRAY[]::public.organization_feature[],
  
  -- Metadados
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Uma configuração por organização
  UNIQUE(organization_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_organization_limits_org ON public.organization_limits(organization_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_organization_limits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_organization_limits_updated_at
BEFORE UPDATE ON public.organization_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_organization_limits_updated_at();

-- Habilitar RLS
ALTER TABLE public.organization_limits ENABLE ROW LEVEL SECURITY;

-- Policies RLS
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all organization limits"
  ON public.organization_limits
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all organization limits"
  ON public.organization_limits
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Org owners podem ver os limites da sua organização
CREATE POLICY "Org owners can view their organization limits"
  ON public.organization_limits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_limits.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Função para obter limites de uma organização (versão inicial - será atualizada na migration de planos)
-- Esta versão inicial não suporta planos, apenas limites customizados
CREATE OR REPLACE FUNCTION public.get_organization_limits(_org_id UUID)
RETURNS TABLE (
  max_leads INTEGER,
  max_evolution_instances INTEGER,
  enabled_features public.organization_feature[],
  current_leads_count BIGINT,
  current_evolution_instances_count BIGINT,
  plan_name TEXT,
  has_custom_limits BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Versão inicial: apenas limites customizados (sem suporte a planos ainda)
  -- Será atualizada na migration 20250130000002 para incluir suporte a planos
  RETURN QUERY
  SELECT 
    COALESCE(ol.max_leads, NULL)::INTEGER as max_leads,
    COALESCE(ol.max_evolution_instances, NULL)::INTEGER as max_evolution_instances,
    COALESCE(ol.enabled_features, ARRAY[]::public.organization_feature[]) as enabled_features,
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT as current_leads_count,
    (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT as current_evolution_instances_count,
    NULL::TEXT as plan_name,
    (ol.id IS NOT NULL)::BOOLEAN as has_custom_limits
  FROM public.organization_limits ol
  WHERE ol.organization_id = _org_id
  UNION ALL
  SELECT 
    NULL::INTEGER,
    NULL::INTEGER,
    ARRAY[]::public.organization_feature[],
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT,
    NULL::TEXT,
    false::BOOLEAN
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_limits WHERE organization_id = _org_id
  )
  LIMIT 1;
END;
$$;

-- Função para verificar se pode criar lead
CREATE OR REPLACE FUNCTION public.can_create_lead(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_current_count BIGINT;
BEGIN
  -- Buscar limites
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Se não há limite definido, permitir
  IF v_limits.max_leads IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se está dentro do limite
  v_current_count := v_limits.current_leads_count;
  
  RETURN v_current_count < v_limits.max_leads;
END;
$$;

-- Função para verificar se pode criar instância EVO
CREATE OR REPLACE FUNCTION public.can_create_evolution_instance(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_current_count BIGINT;
BEGIN
  -- Verificar se a funcionalidade está habilitada
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Verificar se evolution_instances está nas funcionalidades habilitadas
  -- Se há funcionalidades definidas e evolution_instances não está entre elas, bloquear
  IF array_length(v_limits.enabled_features, 1) IS NOT NULL 
     AND array_length(v_limits.enabled_features, 1) > 0 
     AND NOT ('evolution_instances'::public.organization_feature = ANY(v_limits.enabled_features)) THEN
    RETURN FALSE;
  END IF;
  
  -- Se não há limite definido, permitir
  IF v_limits.max_evolution_instances IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se está dentro do limite
  v_current_count := v_limits.current_evolution_instances_count;
  
  RETURN v_current_count < v_limits.max_evolution_instances;
END;
$$;

-- Função para verificar se funcionalidade está habilitada
CREATE OR REPLACE FUNCTION public.has_organization_feature(
  _org_id UUID,
  _feature public.organization_feature
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
BEGIN
  -- Buscar limites
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Se não há funcionalidades definidas, permitir tudo (compatibilidade)
  IF array_length(v_limits.enabled_features, 1) IS NULL OR array_length(v_limits.enabled_features, 1) = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se a funcionalidade está no array
  RETURN _feature = ANY(v_limits.enabled_features);
END;
$$;

-- Comentários para documentação
COMMENT ON TABLE public.organization_limits IS 'Configurações de limites e funcionalidades por organização';
COMMENT ON COLUMN public.organization_limits.max_leads IS 'Número máximo de leads permitidos. NULL = ilimitado';
COMMENT ON COLUMN public.organization_limits.max_evolution_instances IS 'Número máximo de instâncias Evolution permitidas. NULL = ilimitado';
COMMENT ON COLUMN public.organization_limits.enabled_features IS 'Array de funcionalidades habilitadas para a organização';
COMMENT ON FUNCTION public.get_organization_limits(UUID) IS 'Retorna limites e contadores atuais de uma organização';
COMMENT ON FUNCTION public.can_create_lead(UUID) IS 'Verifica se a organização pode criar um novo lead';
COMMENT ON FUNCTION public.can_create_evolution_instance(UUID) IS 'Verifica se a organização pode criar uma nova instância Evolution';
COMMENT ON FUNCTION public.has_organization_feature(UUID, organization_feature) IS 'Verifica se uma funcionalidade está habilitada para a organização';


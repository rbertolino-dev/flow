-- ============================================
-- MIGRAÇÃO: Sistema de Planos
-- ============================================
-- Sistema de planos com limites pré-definidos para facilitar gestão

-- Tabela de planos
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Limites numéricos
  max_leads INTEGER DEFAULT NULL, -- NULL = ilimitado
  max_evolution_instances INTEGER DEFAULT NULL, -- NULL = ilimitado
  
  -- Funcionalidades habilitadas
  enabled_features public.organization_feature[] DEFAULT ARRAY[]::public.organization_feature[],
  
  -- Metadados
  is_active BOOLEAN DEFAULT true,
  price_monthly NUMERIC(10, 2) DEFAULT NULL, -- Preço mensal (opcional)
  price_yearly NUMERIC(10, 2) DEFAULT NULL, -- Preço anual (opcional)
  sort_order INTEGER DEFAULT 0, -- Ordem de exibição
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Adicionar plan_id na tabela organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON public.organizations(plan_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.update_plans_updated_at();

-- Habilitar RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Policies RLS para plans
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all plans"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all plans"
  ON public.plans
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

-- Org owners podem ver planos ativos
CREATE POLICY "Users can view active plans"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Função atualizada para obter limites (busca do plano ou configuração custom)
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
DECLARE
  v_org_plan_id UUID;
  v_plan RECORD;
  v_custom_limits RECORD;
BEGIN
  -- Buscar plano da organização
  SELECT plan_id INTO v_org_plan_id
  FROM public.organizations
  WHERE id = _org_id;

  -- Buscar limites customizados (se existirem)
  SELECT * INTO v_custom_limits
  FROM public.organization_limits
  WHERE organization_id = _org_id;

  -- Se há limites customizados, usar eles (prioridade)
  IF v_custom_limits IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      COALESCE(v_custom_limits.max_leads, NULL)::INTEGER,
      COALESCE(v_custom_limits.max_evolution_instances, NULL)::INTEGER,
      COALESCE(v_custom_limits.enabled_features, ARRAY[]::public.organization_feature[]),
      (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT,
      (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT,
      (SELECT name FROM public.plans WHERE id = v_org_plan_id)::TEXT,
      true::BOOLEAN;
    RETURN;
  END IF;

  -- Se não há limites customizados, buscar do plano
  IF v_org_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.plans
    WHERE id = v_org_plan_id AND is_active = true;

    IF v_plan IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        COALESCE(v_plan.max_leads, NULL)::INTEGER,
        COALESCE(v_plan.max_evolution_instances, NULL)::INTEGER,
        COALESCE(v_plan.enabled_features, ARRAY[]::public.organization_feature[]),
        (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT,
        (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT,
        v_plan.name::TEXT,
        false::BOOLEAN;
      RETURN;
    END IF;
  END IF;

  -- Se não há plano nem limites customizados, retornar ilimitado
  RETURN QUERY
  SELECT 
    NULL::INTEGER,
    NULL::INTEGER,
    ARRAY[]::public.organization_feature[],
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT,
    NULL::TEXT,
    false::BOOLEAN;
END;
$$;

-- Criar planos padrão
INSERT INTO public.plans (name, description, max_leads, max_evolution_instances, enabled_features, sort_order) VALUES
  (
    'Gratuito',
    'Plano básico com funcionalidades essenciais',
    100, -- 100 leads
    1, -- 1 instância Evolution
    ARRAY[
      'leads'::public.organization_feature,
      'evolution_instances'::public.organization_feature,
      'whatsapp_messages'::public.organization_feature
    ]::public.organization_feature[],
    1
  ),
  (
    'Starter',
    'Plano para pequenas empresas',
    500, -- 500 leads
    3, -- 3 instâncias Evolution
    ARRAY[
      'leads'::public.organization_feature,
      'evolution_instances'::public.organization_feature,
      'broadcast'::public.organization_feature,
      'scheduled_messages'::public.organization_feature,
      'whatsapp_messages'::public.organization_feature,
      'call_queue'::public.organization_feature
    ]::public.organization_feature[],
    2
  ),
  (
    'Profissional',
    'Plano completo para empresas em crescimento',
    5000, -- 5000 leads
    10, -- 10 instâncias Evolution
    ARRAY[
      'leads'::public.organization_feature,
      'evolution_instances'::public.organization_feature,
      'broadcast'::public.organization_feature,
      'scheduled_messages'::public.organization_feature,
      'agents'::public.organization_feature,
      'form_builder'::public.organization_feature,
      'whatsapp_messages'::public.organization_feature,
      'call_queue'::public.organization_feature,
      'reports'::public.organization_feature
    ]::public.organization_feature[],
    3
  ),
  (
    'Enterprise',
    'Plano completo com todas as funcionalidades',
    NULL, -- Ilimitado
    NULL, -- Ilimitado
    ARRAY[
      'leads'::public.organization_feature,
      'evolution_instances'::public.organization_feature,
      'broadcast'::public.organization_feature,
      'scheduled_messages'::public.organization_feature,
      'agents'::public.organization_feature,
      'form_builder'::public.organization_feature,
      'facebook_integration'::public.organization_feature,
      'whatsapp_messages'::public.organization_feature,
      'call_queue'::public.organization_feature,
      'reports'::public.organization_feature,
      'api_access'::public.organization_feature
    ]::public.organization_feature[],
    4
  )
ON CONFLICT (name) DO NOTHING;

-- Comentários
COMMENT ON TABLE public.plans IS 'Planos com limites pré-definidos para organizações';
COMMENT ON COLUMN public.plans.max_leads IS 'Número máximo de leads permitidos. NULL = ilimitado';
COMMENT ON COLUMN public.plans.max_evolution_instances IS 'Número máximo de instâncias Evolution permitidas. NULL = ilimitado';
COMMENT ON COLUMN public.plans.enabled_features IS 'Array de funcionalidades habilitadas no plano';
COMMENT ON COLUMN public.organizations.plan_id IS 'Plano associado à organização. NULL = sem plano (ilimitado)';



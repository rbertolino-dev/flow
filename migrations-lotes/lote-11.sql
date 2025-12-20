-- ============================================
-- Lote 11 de Migrations
-- Migrations 201 até 220
-- ============================================

-- ============================================
-- LIMPEZA COMPLETA DE OBJETOS DUPLICADOS
-- ============================================

-- Follow-up Templates - Policies
DROP POLICY IF EXISTS "Etapas de modelo de acompanhamento: os membros podem atualizar" ON public.follow_up_template_steps;
DROP POLICY IF EXISTS "Follow-up template steps: members can update" ON public.follow_up_template_steps;
DROP POLICY IF EXISTS "Follow-up templates: members can select" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can insert" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can update" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can delete" ON public.follow_up_templates;

-- Google Calendar - Triggers e Functions
DROP TRIGGER IF EXISTS trigger_google_calendar_configs_updated_at ON public.google_calendar_configs CASCADE;
DROP FUNCTION IF EXISTS public.update_google_calendar_configs_updated_at() CASCADE;
DROP TRIGGER IF EXISTS trigger_calendar_events_updated_at ON public.calendar_events CASCADE;
DROP FUNCTION IF EXISTS public.update_calendar_events_updated_at() CASCADE;

-- Google Calendar - Policies (todas)
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem selecionar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem inserir" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem atualizar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem excluir" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can select" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can insert" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can update" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can delete" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Calendar events: members can select" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can insert" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can update" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can delete" ON public.calendar_events;

-- Outras policies conhecidas
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
DROP POLICY IF EXISTS "Lead follow-ups: members can select" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "Lead follow-ups: members can update" ON public.lead_follow_ups;

BEGIN;


-- Migration: 20251210230326_557de4d3-a342-428c-8d39-01ab6033c3c2.sql
-- Create user_organizations table to link users with organizations
CREATE TABLE IF NOT EXISTS public.user_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their own organization links"
ON public.user_organizations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage user organizations"
ON public.user_organizations
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.is_pubdigital_user(auth.uid())
);

-- Create assistant_conversations table for AI assistant chat history
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assistant_conversations
CREATE POLICY "Users can view their own conversations"
ON public.assistant_conversations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
ON public.assistant_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
ON public.assistant_conversations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
ON public.assistant_conversations
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_assistant_conversations_updated_at
BEFORE UPDATE ON public.assistant_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Populate user_organizations from existing organization_members
INSERT INTO public.user_organizations (user_id, organization_id)
SELECT user_id, organization_id FROM public.organization_members
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Migration: 20251211190529_3d515e3b-97de-4df5-8ddc-ee6738deb6cc.sql
-- ============================================
-- Migration: Add missing tables and columns
-- ============================================

-- 1. Tabela assistant_config para configurações do assistente DeepSeek
CREATE TABLE IF NOT EXISTS public.assistant_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    system_prompt TEXT,
    tone_of_voice TEXT DEFAULT 'profissional',
    rules TEXT,
    restrictions TEXT,
    examples TEXT,
    temperature NUMERIC DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2000,
    model TEXT DEFAULT 'deepseek-chat',
    is_active BOOLEAN DEFAULT true,
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para assistant_config
ALTER TABLE public.assistant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all assistant config"
ON public.assistant_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can view their org assistant config"
ON public.assistant_config
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()) OR is_global = true);

-- 2. Tabela instance_disconnection_notifications para alertas de desconexão
CREATE TABLE IF NOT EXISTS public.instance_disconnection_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    qr_code TEXT,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    whatsapp_notification_sent_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para instance_disconnection_notifications
ALTER TABLE public.instance_disconnection_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org notifications"
ON public.instance_disconnection_notifications
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can insert their org notifications"
ON public.instance_disconnection_notifications
FOR INSERT
WITH CHECK (organization_id = get_user_organization(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can update their org notifications"
ON public.instance_disconnection_notifications
FOR UPDATE
USING (organization_id = get_user_organization(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can delete their org notifications"
ON public.instance_disconnection_notifications
FOR DELETE
USING (organization_id = get_user_organization(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Índices para instance_disconnection_notifications
CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_instance_id 
ON public.instance_disconnection_notifications(instance_id);

CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_org_id 
ON public.instance_disconnection_notifications(organization_id);

-- 3. Adicionar colunas status, completed_at, completion_notes em calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_assistant_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_assistant_config_updated_at ON public.assistant_config;
CREATE TRIGGER update_assistant_config_updated_at
BEFORE UPDATE ON public.assistant_config
FOR EACH ROW
EXECUTE FUNCTION public.update_assistant_config_updated_at();

CREATE OR REPLACE FUNCTION public.update_instance_disconnection_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_instance_disconnection_notifications_updated_at ON public.instance_disconnection_notifications;
CREATE TRIGGER update_instance_disconnection_notifications_updated_at
BEFORE UPDATE ON public.instance_disconnection_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_instance_disconnection_notifications_updated_at();

-- Migration: 20251211192443_e97f1ac4-6f49-4eb8-a5a0-f280f951c16f.sql
-- Corrigir search_path nas funções
CREATE OR REPLACE FUNCTION public.update_assistant_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_instance_disconnection_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Migration: 20251211193159_d18d2463-af29-4242-a703-d4936a7bde4a.sql
-- Adicionar colunas de mídia na tabela calendar_message_templates
ALTER TABLE public.calendar_message_templates 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Migration: 20251211213126_58b2d9d3-06ba-49b6-ba4c-5673a96fdbf0.sql
-- =============================================
-- FIX CRITICAL SECURITY ISSUES
-- =============================================

-- 1. PROFILES TABLE: Remover policy pública que expõe emails
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Criar policy mais restritiva: usuários só veem perfis da própria organização
CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (
  id = auth.uid() -- Próprio perfil
  OR id IN (
    SELECT om2.user_id 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- 2. LEADS TABLE: Garantir que deleted_at seja sempre filtrado em queries normais
-- e adicionar comentário sobre segurança
COMMENT ON COLUMN public.leads.email IS 'Sensitive PII - protected by organization RLS';
COMMENT ON COLUMN public.leads.phone IS 'Sensitive PII - protected by organization RLS';
COMMENT ON TABLE public.leads IS 'Contains sensitive customer data. Always filter by organization_id and deleted_at IS NULL.';

-- Migration: 20251212000000_add_new_cost_metrics.sql
-- Adicionar novos campos de custo em cloud_cost_config
ALTER TABLE public.cloud_cost_config
ADD COLUMN IF NOT EXISTS cost_per_workflow_execution NUMERIC(10, 6) DEFAULT 0.0001,
ADD COLUMN IF NOT EXISTS cost_per_form_submission NUMERIC(10, 6) DEFAULT 0.0001,
ADD COLUMN IF NOT EXISTS cost_per_agent_ai_call NUMERIC(10, 6) DEFAULT 0.001;

-- Comentários para documentação
COMMENT ON COLUMN public.cloud_cost_config.cost_per_workflow_execution IS 'Custo por execução de workflow periódico (edge function + database operations)';
COMMENT ON COLUMN public.cloud_cost_config.cost_per_form_submission IS 'Custo por submissão de formulário (edge function call + database write)';
COMMENT ON COLUMN public.cloud_cost_config.cost_per_agent_ai_call IS 'Custo por chamada de assistente IA (edge function + API OpenAI/DeepSeek)';



-- Migration: 20251212020656_6bc0101f-23af-4259-9e61-7ce4267479a1.sql

-- Criar tabela organization_onboarding_progress
CREATE TABLE public.organization_onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  step_completed TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, step_completed)
);

-- Enable RLS
ALTER TABLE public.organization_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Policies for organization_onboarding_progress
DROP POLICY IF EXISTS "Users can view their org onboarding" ON public.organization_onboarding_progress;
CREATE POLICY "Users can view their org onboarding" ON public.organization_onboarding_progress
CREATE POLICY "Users can view their org onboarding" ON public.organization_onboarding_progress
FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org onboarding" ON public.organization_onboarding_progress;
CREATE POLICY "Users can insert their org onboarding" ON public.organization_onboarding_progress
CREATE POLICY "Users can insert their org onboarding" ON public.organization_onboarding_progress
FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

DROP POLICY IF EXISTS "Users can update their org onboarding" ON public.organization_onboarding_progress;
CREATE POLICY "Users can update their org onboarding" ON public.organization_onboarding_progress
CREATE POLICY "Users can update their org onboarding" ON public.organization_onboarding_progress
FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));


-- Migration: 20251212020900_8930a69d-1281-4144-ad12-3ef2f50dbb00.sql

-- Adicionar colunas de onboarding à tabela organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS company_profile TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS tax_regime TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS expectations TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;


-- Migration: 20251212023956_65838000-b1fb-4a53-a00d-96416a655f07.sql
-- Adicionar colunas para controle de funcionalidades e trial
ALTER TABLE public.organization_limits 
ADD COLUMN IF NOT EXISTS enabled_features jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS disabled_features jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS features_override_mode text DEFAULT 'inherit'::text;

-- Comentários para documentação
COMMENT ON COLUMN public.organization_limits.enabled_features IS 'Funcionalidades extras habilitadas além do plano (override)';
COMMENT ON COLUMN public.organization_limits.disabled_features IS 'Funcionalidades do plano desabilitadas (override)';
COMMENT ON COLUMN public.organization_limits.trial_ends_at IS 'Data fim do período trial (acesso completo temporário)';
COMMENT ON COLUMN public.organization_limits.features_override_mode IS 'inherit=herda do plano, override=usa apenas enabled_features';

-- Criar função para verificar se organização tem acesso a uma feature
CREATE OR REPLACE FUNCTION public.organization_has_feature(
  _organization_id uuid,
  _feature text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits record;
  v_plan_features jsonb;
  v_is_in_trial boolean;
BEGIN
  -- Buscar limites da organização
  SELECT ol.*, p.features as plan_features
  INTO v_limits
  FROM organization_limits ol
  LEFT JOIN plans p ON ol.plan_id = p.id
  WHERE ol.organization_id = _organization_id;
  
  -- Se não tem registro, assume acesso negado
  IF v_limits IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar se está em período trial (acesso completo)
  v_is_in_trial := v_limits.trial_ends_at IS NOT NULL AND v_limits.trial_ends_at > now();
  IF v_is_in_trial THEN
    -- Durante trial, só bloqueia se estiver explicitamente desabilitado
    IF v_limits.disabled_features IS NOT NULL AND 
       v_limits.disabled_features ? _feature THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;
  
  -- Verificar se está explicitamente desabilitado (override)
  IF v_limits.disabled_features IS NOT NULL AND 
     v_limits.disabled_features ? _feature THEN
    RETURN false;
  END IF;
  
  -- Verificar se está explicitamente habilitado (override)
  IF v_limits.enabled_features IS NOT NULL AND 
     v_limits.enabled_features ? _feature THEN
    RETURN true;
  END IF;
  
  -- Herdar do plano
  v_plan_features := COALESCE(v_limits.plan_features, '[]'::jsonb);
  RETURN v_plan_features ? _feature;
END;
$$;

-- Função para inicializar organização com trial de 30 dias
CREATE OR REPLACE FUNCTION public.initialize_organization_trial(
  _organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organization_limits (
    organization_id,
    trial_ends_at,
    enabled_features,
    disabled_features,
    features_override_mode
  ) VALUES (
    _organization_id,
    now() + interval '30 days',
    '[]'::jsonb,
    '[]'::jsonb,
    'inherit'
  )
  ON CONFLICT (organization_id) 
  DO UPDATE SET
    trial_ends_at = COALESCE(organization_limits.trial_ends_at, now() + interval '30 days'),
    updated_at = now();
END;
$$;

-- Trigger para inicializar trial quando organização é criada
CREATE OR REPLACE FUNCTION public.handle_new_organization_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.initialize_organization_trial(NEW.id);
  RETURN NEW;
END;
$$;

-- Remover trigger se existir e recriar
DROP TRIGGER IF EXISTS on_organization_created_init_trial ON public.organizations;

CREATE TRIGGER on_organization_created_init_trial
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization_trial();

-- Migration: 20251212110125_c50121d5-20d1-4c78-9300-1ffd49bb9ba8.sql
-- Habilitar realtime para organization_limits
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_limits;

-- Migration: 20251212112521_85000b55-e83b-41db-9a6e-beed97f6224d.sql
-- Habilitar Realtime para a tabela organizations
ALTER TABLE public.organizations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;

-- Migration: 20251212112758_06ba4a2d-9c6d-46fd-92cc-6bf5e0d6fe2b.sql
-- Adicionar política para super admins poderem atualizar organizações
CREATE POLICY "Super admins can update organizations" 
ON public.organizations 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Migration: 20251212205126_fb1c8b2c-07ba-4185-b497-37e75edd77c8.sql
-- 1. Adicionar coluna recipient_type que está faltando em whatsapp_workflows
ALTER TABLE public.whatsapp_workflows 
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

-- Atualizar registros existentes baseado no recipient_mode
UPDATE public.whatsapp_workflows
SET recipient_type = CASE 
  WHEN recipient_mode = 'single' THEN 'single'
  WHEN group_id IS NOT NULL THEN 'group'
  ELSE 'list'
END
WHERE recipient_type IS NULL OR recipient_type = 'list';

-- 2. Corrigir funções sem search_path (security warning do linter)
CREATE OR REPLACE FUNCTION public.update_post_sale_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_n8n_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Migration: 20251212205359_14f4ab48-3687-486f-869a-65726e6718d5.sql
-- Criar tabela evolution_providers para gerenciar provedores Evolution por organização
CREATE TABLE IF NOT EXISTS public.evolution_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna para vincular organização ao provider
ALTER TABLE public.organization_limits 
  ADD COLUMN IF NOT EXISTS evolution_provider_id UUID REFERENCES public.evolution_providers(id);

-- Enable RLS
ALTER TABLE public.evolution_providers ENABLE ROW LEVEL SECURITY;

-- Policies - apenas super admins podem gerenciar providers
CREATE POLICY "Super admins can manage evolution providers"
ON public.evolution_providers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
  OR public.is_pubdigital_user(auth.uid())
);

-- Trigger para updated_at
CREATE TRIGGER update_evolution_providers_updated_at
  BEFORE UPDATE ON public.evolution_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251212205712_c83b6a7a-2a04-4406-a111-fa76da58c7c1.sql
-- Criar funções RPC para gerenciar providers de organizações

-- Função para verificar se organização tem provider associado
CREATE OR REPLACE FUNCTION public.organization_has_evolution_provider(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_limits ol
    WHERE ol.organization_id = _org_id
      AND ol.evolution_provider_id IS NOT NULL
  );
$$;

-- Função para obter o provider Evolution de uma organização
CREATE OR REPLACE FUNCTION public.get_organization_evolution_provider(_org_id uuid)
RETURNS TABLE(
  provider_id uuid,
  provider_name text,
  api_url text,
  api_key text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ep.id as provider_id,
    ep.name as provider_name,
    ep.api_url,
    ep.api_key
  FROM organization_limits ol
  INNER JOIN evolution_providers ep ON ep.id = ol.evolution_provider_id
  WHERE ol.organization_id = _org_id
    AND ep.is_active = true;
$$;

-- Migration: 20251212210358_eee87fc4-cce4-49b5-9423-bf96b2cab6b3.sql
-- Remover política existente e criar novas políticas completas para evolution_providers
DROP POLICY IF EXISTS "Super admins can manage evolution providers" ON public.evolution_providers;

-- Policy para SELECT
CREATE POLICY "Super admins can view evolution providers"
ON public.evolution_providers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid())
);

-- Policy para INSERT
CREATE POLICY "Super admins can create evolution providers"
ON public.evolution_providers
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid())
);

-- Policy para UPDATE
CREATE POLICY "Super admins can update evolution providers"
ON public.evolution_providers
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid())
);

-- Policy para DELETE
CREATE POLICY "Super admins can delete evolution providers"
ON public.evolution_providers
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid())
);

-- Migration: 20251214012651_c9a1d43a-6f0a-4f3d-b15b-945e450dd57b.sql
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

-- Migration: 20251214013357_71d1b0a4-d7e5-4604-a666-86053ffbf79b.sql
-- Corrigir função para lidar com enabled_features NULL
CREATE OR REPLACE FUNCTION public.can_create_evolution_instance(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_limits RECORD;
  current_count INTEGER;
  features_array TEXT[];
BEGIN
  -- Buscar limites da organização
  SELECT * INTO org_limits
  FROM organization_limits
  WHERE organization_id = _org_id;
  
  -- Se não existe registro, não pode criar
  IF org_limits IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Obter array de features (COALESCE para evitar NULL)
  features_array := COALESCE(org_limits.enabled_features, ARRAY[]::TEXT[]);
  
  -- Verificar se a feature evolution_instances está habilitada
  IF NOT ('evolution_instances' = ANY(features_array)) THEN
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

-- Migration: 20251214014400_bd923643-e1a4-4c16-9e6f-8bbfa19f4775.sql
-- Corrigir função para usar JSONB ao invés de TEXT[]
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
  
  -- Verificar se a feature evolution_instances está habilitada (usando JSONB)
  IF org_limits.enabled_features IS NULL OR 
     NOT (org_limits.enabled_features ? 'evolution_instances') THEN
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

-- Migration: 20251214024437_81ac15af-bf0e-4cd9-a615-d3b4b84f21b1.sql
-- Adicionar colunas faltantes na tabela cloud_cost_config
ALTER TABLE public.cloud_cost_config 
  ADD COLUMN IF NOT EXISTS cost_per_workflow_execution NUMERIC DEFAULT 0.00001,
  ADD COLUMN IF NOT EXISTS cost_per_form_submission NUMERIC DEFAULT 0.00001,
  ADD COLUMN IF NOT EXISTS cost_per_agent_ai_call NUMERIC DEFAULT 0.0001;

COMMIT;

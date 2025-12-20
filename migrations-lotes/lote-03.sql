-- ============================================
-- Lote 3 de Migrations
-- Migrations 41 até 60
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


-- Migration: 20250131000003_add_onboarding_fields.sql
-- ============================================
-- MIGRAÇÃO: Adicionar campos de onboarding na tabela organizations
-- ============================================

-- Adicionar campos de onboarding na tabela organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS company_profile TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS tax_regime TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS expectations TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN public.organizations.company_profile IS 'Perfil da empresa: MEI, ME, EIRELI, LTDA, etc.';
COMMENT ON COLUMN public.organizations.state IS 'Estado da organização';
COMMENT ON COLUMN public.organizations.city IS 'Cidade da organização';
COMMENT ON COLUMN public.organizations.tax_regime IS 'Regime tributário: MEI, ME, Simples Nacional, Lucro Presumido, Lucro Real';
COMMENT ON COLUMN public.organizations.business_type IS 'Tipo de negócio: products_and_services, products_only, services_only';
COMMENT ON COLUMN public.organizations.expectations IS 'O que a empresa espera do sistema';
COMMENT ON COLUMN public.organizations.onboarding_completed IS 'Indica se o onboarding foi completado';
COMMENT ON COLUMN public.organizations.onboarding_completed_at IS 'Data e hora de conclusão do onboarding';




-- Migration: 20250131000003_create_evolution_providers.sql
-- ============================================
-- MIGRAÇÃO: Evolution Providers
-- ============================================
-- Sistema para gerenciar providers Evolution disponíveis e associá-los às organizações

-- Tabela de providers Evolution (links e API keys disponíveis)
CREATE TABLE IF NOT EXISTS public.evolution_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Nome descritivo do provider (ex: "Evolution Principal", "Evolution Backup")
  api_url TEXT NOT NULL, -- URL da API Evolution
  api_key TEXT NOT NULL, -- API Key do Evolution
  is_active BOOLEAN DEFAULT true, -- Se o provider está ativo
  description TEXT, -- Descrição opcional
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Garantir que não há URLs duplicadas
  UNIQUE(api_url)
);

-- Tabela de relacionamento entre organização e provider Evolution
CREATE TABLE IF NOT EXISTS public.organization_evolution_provider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  evolution_provider_id UUID NOT NULL REFERENCES public.evolution_providers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Uma organização pode ter apenas um provider Evolution ativo
  UNIQUE(organization_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_evolution_providers_active ON public.evolution_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_org_evolution_provider_org ON public.organization_evolution_provider(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_evolution_provider_provider ON public.organization_evolution_provider(evolution_provider_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_evolution_providers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_evolution_providers_updated_at
BEFORE UPDATE ON public.evolution_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_evolution_providers_updated_at();

CREATE OR REPLACE FUNCTION public.update_org_evolution_provider_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_org_evolution_provider_updated_at
BEFORE UPDATE ON public.organization_evolution_provider
FOR EACH ROW
EXECUTE FUNCTION public.update_org_evolution_provider_updated_at();

-- Habilitar RLS
ALTER TABLE public.evolution_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_evolution_provider ENABLE ROW LEVEL SECURITY;

-- Policies RLS para evolution_providers
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all evolution providers"
  ON public.evolution_providers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all evolution providers"
  ON public.evolution_providers
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

-- REMOVIDO: Usuários NÃO devem ver providers diretamente por segurança
-- Eles só podem acessar via função RPC que valida permissões e retorna apenas o provider da sua organização
-- Isso previne que usuários vejam API keys de outros providers

-- Policies RLS para organization_evolution_provider
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all organization evolution providers"
  ON public.organization_evolution_provider
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all organization evolution providers"
  ON public.organization_evolution_provider
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

-- Org owners podem ver o provider da sua organização
CREATE POLICY "Org owners can view their organization evolution provider"
  ON public.organization_evolution_provider
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_evolution_provider.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Função para obter o provider Evolution de uma organização
CREATE OR REPLACE FUNCTION public.get_organization_evolution_provider(_org_id UUID)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  api_url TEXT,
  api_key TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  RETURN QUERY
  SELECT 
    ep.id,
    ep.name,
    ep.api_url,
    ep.api_key
  FROM public.organization_evolution_provider oep
  INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
  WHERE oep.organization_id = _org_id
    AND ep.is_active = true;
END;
$$;



-- Migration: 20250131000004_create_onboarding_progress.sql
-- ============================================
-- MIGRAÇÃO: Criar tabela de progresso do onboarding
-- ============================================

-- Criar tabela de progresso do onboarding
CREATE TABLE IF NOT EXISTS public.organization_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_completed TEXT NOT NULL, -- 'organization', 'users', 'pipeline', 'products', 'evolution'
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, step_completed)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_org ON public.organization_onboarding_progress(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_step ON public.organization_onboarding_progress(step_completed);

-- Habilitar RLS
ALTER TABLE public.organization_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view onboarding progress of their organization"
ON public.organization_onboarding_progress FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert onboarding progress for their organization"
ON public.organization_onboarding_progress FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update onboarding progress of their organization"
ON public.organization_onboarding_progress FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Comentários para documentação
COMMENT ON TABLE public.organization_onboarding_progress IS 'Rastreia o progresso do onboarding por organização';
COMMENT ON COLUMN public.organization_onboarding_progress.step_completed IS 'Etapa completada: organization, users, pipeline, products, evolution';




-- Migration: 20250131000004_secure_evolution_providers.sql
-- ============================================
-- MIGRAÇÃO: Segurança adicional para Evolution Providers
-- ============================================
-- Garantir que usuários não possam ver ou acessar providers de outras organizações

-- Remover política que permitia usuários verem providers ativos
DROP POLICY IF EXISTS "Users can view active evolution providers" ON public.evolution_providers;

-- Garantir que apenas super admins podem ver providers diretamente
-- Usuários só podem acessar via função RPC que valida permissões

-- Adicionar verificação adicional na função RPC para garantir que apenas retorna o provider da organização do usuário
CREATE OR REPLACE FUNCTION public.get_organization_evolution_provider(_org_id UUID)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  api_url TEXT,
  api_key TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_has_provider BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  -- Verificar se a organização tem um provider configurado
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  ) INTO v_has_provider;

  -- Só retornar dados se houver provider configurado
  IF v_has_provider THEN
    RETURN QUERY
    SELECT 
      ep.id,
      ep.name,
      ep.api_url,
      ep.api_key
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
    LIMIT 1;
  END IF;
  
  -- Se não houver provider, retorna vazio (não gera erro)
  RETURN;
END;
$$;

-- Função auxiliar para verificar se uma organização tem provider configurado (sem retornar dados sensíveis)
CREATE OR REPLACE FUNCTION public.organization_has_evolution_provider(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RETURN false;
  END IF;

  -- Retornar true se houver provider ativo configurado
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  );
END;
$$;




-- Migration: 20250131000005_create_evolution_providers.sql
-- ============================================
-- MIGRAÇÃO: Evolution Providers
-- ============================================
-- Sistema para gerenciar providers Evolution disponíveis e associá-los às organizações

-- Tabela de providers Evolution (links e API keys disponíveis)
CREATE TABLE IF NOT EXISTS public.evolution_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Nome descritivo do provider (ex: "Evolution Principal", "Evolution Backup")
  api_url TEXT NOT NULL, -- URL da API Evolution
  api_key TEXT NOT NULL, -- API Key do Evolution
  is_active BOOLEAN DEFAULT true, -- Se o provider está ativo
  description TEXT, -- Descrição opcional
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Garantir que não há URLs duplicadas
  UNIQUE(api_url)
);

-- Tabela de relacionamento entre organização e provider Evolution
CREATE TABLE IF NOT EXISTS public.organization_evolution_provider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  evolution_provider_id UUID NOT NULL REFERENCES public.evolution_providers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Uma organização pode ter apenas um provider Evolution ativo
  UNIQUE(organization_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_evolution_providers_active ON public.evolution_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_org_evolution_provider_org ON public.organization_evolution_provider(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_evolution_provider_provider ON public.organization_evolution_provider(evolution_provider_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_evolution_providers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_evolution_providers_updated_at
BEFORE UPDATE ON public.evolution_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_evolution_providers_updated_at();

CREATE OR REPLACE FUNCTION public.update_org_evolution_provider_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_org_evolution_provider_updated_at
BEFORE UPDATE ON public.organization_evolution_provider
FOR EACH ROW
EXECUTE FUNCTION public.update_org_evolution_provider_updated_at();

-- Habilitar RLS
ALTER TABLE public.evolution_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_evolution_provider ENABLE ROW LEVEL SECURITY;

-- Policies RLS para evolution_providers
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all evolution providers"
  ON public.evolution_providers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all evolution providers"
  ON public.evolution_providers
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

-- REMOVIDO: Usuários NÃO devem ver providers diretamente por segurança
-- Eles só podem acessar via função RPC que valida permissões e retorna apenas o provider da sua organização
-- Isso previne que usuários vejam API keys de outros providers

-- Policies RLS para organization_evolution_provider
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all organization evolution providers"
  ON public.organization_evolution_provider
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all organization evolution providers"
  ON public.organization_evolution_provider
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

-- Org owners podem ver o provider da sua organização
CREATE POLICY "Org owners can view their organization evolution provider"
  ON public.organization_evolution_provider
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_evolution_provider.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Função para obter o provider Evolution de uma organização
CREATE OR REPLACE FUNCTION public.get_organization_evolution_provider(_org_id UUID)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  api_url TEXT,
  api_key TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  RETURN QUERY
  SELECT 
    ep.id,
    ep.name,
    ep.api_url,
    ep.api_key
  FROM public.organization_evolution_provider oep
  INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
  WHERE oep.organization_id = _org_id
    AND ep.is_active = true;
END;
$$;



-- Migration: 20250131000006_secure_evolution_providers.sql
-- ============================================
-- MIGRAÇÃO: Segurança adicional para Evolution Providers
-- ============================================
-- Garantir que usuários não possam ver ou acessar providers de outras organizações

-- Remover política que permitia usuários verem providers ativos
DROP POLICY IF EXISTS "Users can view active evolution providers" ON public.evolution_providers;

-- Garantir que apenas super admins podem ver providers diretamente
-- Usuários só podem acessar via função RPC que valida permissões

-- Adicionar verificação adicional na função RPC para garantir que apenas retorna o provider da organização do usuário
CREATE OR REPLACE FUNCTION public.get_organization_evolution_provider(_org_id UUID)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  api_url TEXT,
  api_key TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_has_provider BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  -- Verificar se a organização tem um provider configurado
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  ) INTO v_has_provider;

  -- Só retornar dados se houver provider configurado
  IF v_has_provider THEN
    RETURN QUERY
    SELECT 
      ep.id,
      ep.name,
      ep.api_url,
      ep.api_key
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
    LIMIT 1;
  END IF;
  
  -- Se não houver provider, retorna vazio (não gera erro)
  RETURN;
END;
$$;

-- Função auxiliar para verificar se uma organização tem provider configurado (sem retornar dados sensíveis)
CREATE OR REPLACE FUNCTION public.organization_has_evolution_provider(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RETURN false;
  END IF;

  -- Retornar true se houver provider ativo configurado
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  );
END;
$$;



-- Migration: 20251106174217_remix_batch_1_migrations.sql

-- Migration: 20251106024613

-- Migration: 20251105204309
-- Tabela de configuração da Evolution API
CREATE TABLE IF NOT EXISTS public.evolution_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_url TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  api_key TEXT,
  is_connected BOOLEAN DEFAULT false,
  qr_code TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  value DECIMAL(10,2),
  source TEXT DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de atividades
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de fila de ligações
CREATE TABLE IF NOT EXISTS public.call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON public.activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_lead_id ON public.call_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_evolution_config_user_id ON public.evolution_config(user_id);

-- Enable RLS
ALTER TABLE public.evolution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies para evolution_config
CREATE POLICY "Users can view their own config"
  ON public.evolution_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config"
  ON public.evolution_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config"
  ON public.evolution_config FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies para leads
CREATE POLICY "Users can view their own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
  ON public.leads FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para activities
CREATE POLICY "Users can view activities of their leads"
  ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = activities.lead_id
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activities for their leads"
  ON public.activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = activities.lead_id
      AND leads.user_id = auth.uid()
    )
  );

-- RLS Policies para call_queue
CREATE POLICY "Users can view their own call queue"
  ON public.call_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = call_queue.lead_id
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert into their call queue"
  ON public.call_queue FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = call_queue.lead_id
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their call queue"
  ON public.call_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = call_queue.lead_id
      AND leads.user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_evolution_config_updated_at
  BEFORE UPDATE ON public.evolution_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for leads and activities
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.call_queue REPLICA IDENTITY FULL;

-- Migration: 20251105204414
-- Corrigir função update_updated_at_column com search_path seguro
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Migration: 20251105210120
-- Enable realtime for leads and call_queue tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_queue;



-- Migration: 20251106233518_ed5dbae0-e403-498b-8f81-72db92002bd6.sql
-- Adicionar colunas necessárias à tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON public.leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);

-- Backfill: setar stage_id para a primeira etapa (posição 0) de cada usuário
UPDATE public.leads
SET stage_id = (
  SELECT ps.id 
  FROM public.pipeline_stages ps 
  WHERE ps.user_id = leads.user_id 
  ORDER BY ps.position ASC 
  LIMIT 1
)
WHERE stage_id IS NULL;

-- Adicionar tabelas ao realtime (se ainda não estiverem)
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tags;

-- Migration: 20251107000903_62ac6360-54c6-49bb-97f0-e4dd9b54844c.sql
-- Add call_notes and call_count columns to call_queue table
ALTER TABLE public.call_queue 
ADD COLUMN IF NOT EXISTS call_notes TEXT,
ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;

-- Migration: 20251107001601_bb10eeff-1035-4073-a1e2-4f50f6bac683.sql
-- Add columns to track who completed the call and when
ALTER TABLE public.call_queue 
ADD COLUMN IF NOT EXISTS completed_by TEXT,
ADD COLUMN IF NOT EXISTS completed_by_user_id UUID;

-- Migration: 20251107002130_b9ef4a79-c506-43f8-bb95-e11ab551da05.sql
-- Add call_count column to leads table to track total calls per lead
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;

-- Migration: 20251107002729_8ed8b420-b97e-4c92-961e-d2f736e54cbc.sql
-- Create table to link tags with call queue items
CREATE TABLE IF NOT EXISTS public.call_queue_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_queue_id UUID NOT NULL REFERENCES public.call_queue(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(call_queue_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.call_queue_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for call_queue_tags
CREATE POLICY "Users can view tags on their call queue items"
ON public.call_queue_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.call_queue cq
    JOIN public.leads l ON l.id = cq.lead_id
    WHERE cq.id = call_queue_tags.call_queue_id
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add tags to their call queue items"
ON public.call_queue_tags
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.call_queue cq
    JOIN public.leads l ON l.id = cq.lead_id
    WHERE cq.id = call_queue_tags.call_queue_id
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove tags from their call queue items"
ON public.call_queue_tags
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.call_queue cq
    JOIN public.leads l ON l.id = cq.lead_id
    WHERE cq.id = call_queue_tags.call_queue_id
    AND l.user_id = auth.uid()
  )
);

-- Migration: 20251107011930_efde0016-c1e4-46a8-9869-97ba0763132e.sql
-- Create evolution_logs table for debugging and monitoring
CREATE TABLE IF NOT EXISTS public.evolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  instance TEXT,
  event TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolution_logs ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evolution_logs_user_created ON public.evolution_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_logs_event ON public.evolution_logs (event);

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evolution_logs' AND policyname = 'Users can view their own evolution logs'
  ) THEN
    CREATE POLICY "Users can view their own evolution logs"
    ON public.evolution_logs
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evolution_logs' AND policyname = 'Users can insert their own evolution logs'
  ) THEN
    CREATE POLICY "Users can insert their own evolution logs"
    ON public.evolution_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Migration: 20251107012108_4293e55e-6f83-4d6f-ab8f-5e9b573464db.sql
-- Create evolution_logs table for debugging and monitoring
CREATE TABLE IF NOT EXISTS public.evolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  instance TEXT,
  event TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolution_logs ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evolution_logs_user_created ON public.evolution_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_logs_event ON public.evolution_logs (event);

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evolution_logs' AND policyname = 'Users can view their own evolution logs'
  ) THEN
    CREATE POLICY "Users can view their own evolution logs"
    ON public.evolution_logs
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evolution_logs' AND policyname = 'Users can insert their own evolution logs'
  ) THEN
    CREATE POLICY "Users can insert their own evolution logs"
    ON public.evolution_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Migration: 20251107013620_87fdeea1-f9b1-4663-84cc-2d29fdea37e2.sql
-- Ensure unique constraint for upsert in imports
ALTER TABLE public.leads
ADD CONSTRAINT leads_user_phone_unique UNIQUE (user_id, phone);

-- Helpful index for queries by user and stage (optional but lightweight)
CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON public.leads (user_id, stage_id);


-- Migration: 20251107015920_5454c55f-ec1e-481b-aaca-3922838f1466.sql
-- Criar tabela para contatos internacionais
CREATE TABLE public.international_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country_code TEXT,
  email TEXT,
  company TEXT,
  source TEXT DEFAULT 'whatsapp',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_contact TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Criar tabela para contatos WhatsApp LID (Business/Canais)
CREATE TABLE public.whatsapp_lid_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  lid TEXT NOT NULL UNIQUE,
  profile_pic_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_contact TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
DROP INDEX IF EXISTS idx_international_contacts_user_id CASCADE;
CREATE INDEX idx_international_contacts_user_id ON
CREATE INDEX idx_international_contacts_user_id ON public.international_contacts(user_id);
DROP INDEX IF EXISTS idx_international_contacts_phone CASCADE;
CREATE INDEX idx_international_contacts_phone ON
CREATE INDEX idx_international_contacts_phone ON public.international_contacts(phone);
DROP INDEX IF EXISTS idx_whatsapp_lid_contacts_user_id CASCADE;
CREATE INDEX idx_whatsapp_lid_contacts_user_id ON
CREATE INDEX idx_whatsapp_lid_contacts_user_id ON public.whatsapp_lid_contacts(user_id);
DROP INDEX IF EXISTS idx_whatsapp_lid_contacts_lid CASCADE;
CREATE INDEX idx_whatsapp_lid_contacts_lid ON
CREATE INDEX idx_whatsapp_lid_contacts_lid ON public.whatsapp_lid_contacts(lid);

-- RLS para international_contacts
ALTER TABLE public.international_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own international contacts"
ON public.international_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own international contacts"
ON public.international_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own international contacts"
ON public.international_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own international contacts"
ON public.international_contacts FOR DELETE
USING (auth.uid() = user_id);

-- RLS para whatsapp_lid_contacts
ALTER TABLE public.whatsapp_lid_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own LID contacts"
ON public.whatsapp_lid_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own LID contacts"
ON public.whatsapp_lid_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LID contacts"
ON public.whatsapp_lid_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LID contacts"
ON public.whatsapp_lid_contacts FOR DELETE
USING (auth.uid() = user_id);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_international_contacts_updated_at
BEFORE UPDATE ON public.international_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_lid_contacts_updated_at
BEFORE UPDATE ON public.whatsapp_lid_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251107030133_48c58412-604a-44ac-afa1-c8d5c0ac28b4.sql
-- Criar tabela para histórico da fila de ligações
CREATE TABLE IF NOT EXISTS public.call_queue_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by TEXT,
  completed_by_user_id UUID,
  status TEXT NOT NULL,
  priority TEXT,
  notes TEXT,
  call_notes TEXT,
  call_count INTEGER DEFAULT 0,
  action TEXT NOT NULL, -- 'completed', 'deleted', 'rescheduled'
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_queue_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own call queue history"
ON public.call_queue_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call queue history"
ON public.call_queue_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own call queue history"
ON public.call_queue_history
FOR DELETE
USING (auth.uid() = user_id);

-- Criar índice para melhor performance
DROP INDEX IF EXISTS idx_call_queue_history_user_id CASCADE;
CREATE INDEX idx_call_queue_history_user_id ON
CREATE INDEX idx_call_queue_history_user_id ON public.call_queue_history(user_id);
DROP INDEX IF EXISTS idx_call_queue_history_created_at CASCADE;
CREATE INDEX idx_call_queue_history_created_at ON
CREATE INDEX idx_call_queue_history_created_at ON public.call_queue_history(created_at DESC);

-- Migration: 20251107041635_8904d17c-9647-474e-8ce1-c2ddc0b843fd.sql
-- Adicionar campo para controlar se o webhook está ativado para cada instância
ALTER TABLE public.evolution_config
ADD COLUMN webhook_enabled boolean NOT NULL DEFAULT true;

-- Adicionar índice para melhorar performance de buscas por usuário
CREATE INDEX IF NOT EXISTS idx_evolution_config_user_id ON public.evolution_config(user_id);

-- Adicionar política RLS para permitir delete
DROP POLICY IF EXISTS "Users can delete their own config" ON public.evolution_config;
CREATE POLICY "Users can delete their own config"
ON public.evolution_config
FOR DELETE
USING (auth.uid() = user_id);

-- Migration: 20251107044327_6f9cd2d3-f0f6-48e6-b645-dafbf16b92a7.sql
-- Criar tabela de templates de mensagens
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own templates"
ON public.message_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
ON public.message_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.message_templates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.message_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251107051816_4a07306b-ff49-4d03-b133-a9d5ad0efe3b.sql
-- Adicionar campos de mídia na tabela message_templates
ALTER TABLE public.message_templates
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video', 'document'));

COMMIT;

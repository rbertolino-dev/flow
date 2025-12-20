-- ============================================
-- SCRIPT GERAL: Criar TODAS as tabelas e estruturas necessárias
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script verifica e cria TODAS as tabelas, colunas, funções e políticas
-- necessárias para o funcionamento completo da aplicação
-- 
-- SEGURO: Pode executar múltiplas vezes (usa IF NOT EXISTS)
-- ============================================

-- ============================================
-- PARTE 1: Tipos e Enums
-- ============================================

-- Enum app_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- Enum organization_feature
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_feature') THEN
    CREATE TYPE public.organization_feature AS ENUM (
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
  END IF;
END $$;

-- ============================================
-- PARTE 2: Funções Auxiliares Globais
-- ============================================

-- Função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função is_pubdigital_user
CREATE OR REPLACE FUNCTION public.is_pubdigital_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = _user_id
      AND LOWER(o.name) LIKE '%pubdigital%'
  )
$$;

-- Função get_user_organization
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- Função user_belongs_to_org
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- ============================================
-- PARTE 3: Tabelas Principais (ordem de dependências)
-- ============================================

-- Tabela user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    CREATE TABLE public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      role public.app_role NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    );

    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Everyone can view user roles"
    ON public.user_roles
    FOR SELECT
    USING (true);

    CREATE POLICY "Only admins can manage roles"
    ON public.user_roles
    FOR ALL
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- Tabela plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'plans'
  ) THEN
    CREATE TABLE public.plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      max_leads INTEGER DEFAULT NULL,
      max_evolution_instances INTEGER DEFAULT NULL,
      enabled_features public.organization_feature[] DEFAULT ARRAY[]::public.organization_feature[],
      is_active BOOLEAN DEFAULT true,
      price_monthly NUMERIC(10, 2) DEFAULT NULL,
      price_yearly NUMERIC(10, 2) DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by UUID REFERENCES auth.users(id)
    );

    CREATE INDEX idx_plans_active ON public.plans(is_active) WHERE is_active = true;

    ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Super admins can view all plans"
    ON public.plans
    FOR SELECT
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );

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

    CREATE POLICY "Users can view active plans"
    ON public.plans
    FOR SELECT
    TO authenticated
    USING (is_active = true);

    CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Tabela evolution_providers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'evolution_providers'
  ) THEN
    CREATE TABLE public.evolution_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      api_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by UUID REFERENCES auth.users(id),
      UNIQUE(api_url)
    );

    CREATE INDEX idx_evolution_providers_active ON public.evolution_providers(is_active) WHERE is_active = true;

    ALTER TABLE public.evolution_providers ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Super admins can view all evolution providers"
    ON public.evolution_providers
    FOR SELECT
    TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );

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

    CREATE TRIGGER update_evolution_providers_updated_at
    BEFORE UPDATE ON public.evolution_providers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Adicionar coluna evolution_provider_id em organization_limits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_limits'
      AND column_name = 'evolution_provider_id'
  ) THEN
    ALTER TABLE public.organization_limits
    ADD COLUMN evolution_provider_id UUID REFERENCES public.evolution_providers(id);
  END IF;
END $$;

-- Tabela lead_tags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lead_tags'
  ) THEN
    CREATE TABLE public.lead_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(lead_id, tag_id)
    );

    CREATE INDEX idx_lead_tags_lead_id ON public.lead_tags(lead_id);
    CREATE INDEX idx_lead_tags_tag_id ON public.lead_tags(tag_id);

    ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view lead_tags of their organization leads"
    ON public.lead_tags
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_tags.lead_id
        AND l.organization_id = public.get_user_organization(auth.uid())
      )
    );

    CREATE POLICY "Super admins can view all lead_tags"
    ON public.lead_tags
    FOR SELECT
    USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );
  END IF;
END $$;

-- Tabela message_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_templates'
  ) THEN
    CREATE TABLE public.message_templates (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_message_templates_user_id ON public.message_templates(user_id);
    CREATE INDEX idx_message_templates_org_id ON public.message_templates(organization_id);

    ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view their own templates"
    ON public.message_templates
    FOR SELECT
    USING (auth.uid() = user_id);

    CREATE POLICY "Users can create their own templates"
    ON public.message_templates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Super admins can view all message_templates"
    ON public.message_templates
    FOR SELECT
    USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON public.message_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Tabela instance_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'instance_groups'
  ) THEN
    CREATE TABLE public.instance_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      instance_ids UUID[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, name)
    );

    CREATE INDEX idx_instance_groups_org ON public.instance_groups(organization_id);

    ALTER TABLE public.instance_groups ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view instance groups of their organization"
    ON public.instance_groups
    FOR SELECT
    USING (
      organization_id = get_user_organization(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE TRIGGER update_instance_groups_updated_at
    BEFORE UPDATE ON public.instance_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Tabela broadcast_campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcast_campaigns'
  ) THEN
    CREATE TABLE public.broadcast_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      message_template_id UUID REFERENCES public.message_templates(id),
      custom_message TEXT,
      instance_id UUID REFERENCES public.evolution_config(id) NOT NULL,
      min_delay_seconds INTEGER NOT NULL DEFAULT 30,
      max_delay_seconds INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'draft',
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      CONSTRAINT valid_status CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled'))
    );

    CREATE INDEX idx_broadcast_campaigns_user_id ON public.broadcast_campaigns(user_id);
    CREATE INDEX idx_broadcast_campaigns_org_id ON public.broadcast_campaigns(organization_id);

    ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view their own campaigns"
    ON public.broadcast_campaigns
    FOR SELECT
    USING (auth.uid() = user_id);

    CREATE POLICY "Super admins can view all broadcast_campaigns"
    ON public.broadcast_campaigns
    FOR SELECT
    USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );
  END IF;
END $$;

-- Tabela broadcast_time_windows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcast_time_windows'
  ) THEN
    CREATE TABLE public.broadcast_time_windows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      monday_start TIME,
      monday_end TIME,
      tuesday_start TIME,
      tuesday_end TIME,
      wednesday_start TIME,
      wednesday_end TIME,
      thursday_start TIME,
      thursday_end TIME,
      friday_start TIME,
      friday_end TIME,
      saturday_start TIME,
      saturday_end TIME,
      sunday_start TIME,
      sunday_end TIME,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, name)
    );

    CREATE INDEX idx_broadcast_time_windows_org ON public.broadcast_time_windows(organization_id);
    CREATE INDEX idx_broadcast_time_windows_enabled ON public.broadcast_time_windows(organization_id, enabled) WHERE enabled = true;

    ALTER TABLE public.broadcast_time_windows ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view time windows of their organization"
    ON public.broadcast_time_windows
    FOR SELECT
    USING (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE TRIGGER update_broadcast_time_windows_updated_at
    BEFORE UPDATE ON public.broadcast_time_windows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Tabela broadcast_campaign_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcast_campaign_templates'
  ) THEN
    CREATE TABLE public.broadcast_campaign_templates (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      organization_id UUID NOT NULL,
      user_id UUID NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      instance_id UUID,
      instance_name TEXT,
      message_template_id UUID,
      custom_message TEXT,
      min_delay_seconds INTEGER NOT NULL DEFAULT 30,
      max_delay_seconds INTEGER NOT NULL DEFAULT 60,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_broadcast_campaign_templates_org_id ON public.broadcast_campaign_templates(organization_id);

    ALTER TABLE public.broadcast_campaign_templates ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view organization campaign templates"
    ON public.broadcast_campaign_templates
    FOR SELECT
    USING (organization_id = get_user_organization(auth.uid()));

    CREATE POLICY "Super admins can view all campaign templates"
    ON public.broadcast_campaign_templates
    FOR SELECT
    USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE TRIGGER update_broadcast_campaign_templates_updated_at
    BEFORE UPDATE ON public.broadcast_campaign_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- PARTE 4: Função RPC get_all_organizations_with_members
-- ============================================

CREATE OR REPLACE FUNCTION public.get_all_organizations_with_members()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_created_at timestamptz,
  org_plan_id uuid,
  member_user_id uuid,
  member_role text,
  member_created_at timestamptz,
  member_email text,
  member_full_name text,
  member_roles jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id as org_id,
    o.name as org_name,
    o.created_at as org_created_at,
    ol.plan_id as org_plan_id,
    om.user_id as member_user_id,
    om.role as member_role,
    om.created_at as member_created_at,
    p.email as member_email,
    p.full_name as member_full_name,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('role', ur.role))
      FROM user_roles ur
      WHERE ur.user_id = om.user_id
    ), '[]'::jsonb) as member_roles
  FROM organizations o
  LEFT JOIN organization_limits ol ON ol.organization_id = o.id
  LEFT JOIN organization_members om ON om.organization_id = o.id
  LEFT JOIN profiles p ON p.id = om.user_id
  ORDER BY o.created_at DESC;
$$;

-- ============================================
-- PARTE 5: Garantir colunas faltantes em tabelas existentes
-- ============================================

-- Garantir que leads tem stage_id e deleted_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'stage_id'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN stage_id UUID REFERENCES public.pipeline_stages(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Garantir que pipeline_stages tem user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_stages' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.pipeline_stages ADD COLUMN user_id UUID REFERENCES public.profiles(id);
  END IF;
END $$;

-- Garantir que call_queue tem organization_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_queue' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.call_queue ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
  END IF;
END $$;

-- Garantir que products tem is_active
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.products ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Garantir que organizations tem todas as colunas de onboarding
-- Usar ALTER TABLE direto (não dentro de DO $$) para forçar atualização do cache do PostgREST
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS company_profile TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS tax_regime TEXT,
  ADD COLUMN IF NOT EXISTS expectations TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Adicionar comentários
COMMENT ON COLUMN public.organizations.business_type IS 'Tipo de negócio: products_and_services, products_only, services_only';
COMMENT ON COLUMN public.organizations.company_profile IS 'Perfil da empresa: MEI, ME, EIRELI, LTDA, etc.';
COMMENT ON COLUMN public.organizations.state IS 'Estado da organização';
COMMENT ON COLUMN public.organizations.city IS 'Cidade da organização';
COMMENT ON COLUMN public.organizations.tax_regime IS 'Regime tributário: MEI, ME, Simples Nacional, Lucro Presumido, Lucro Real';
COMMENT ON COLUMN public.organizations.expectations IS 'O que a empresa espera do sistema';
COMMENT ON COLUMN public.organizations.onboarding_completed IS 'Indica se o onboarding foi completado';
COMMENT ON COLUMN public.organizations.onboarding_completed_at IS 'Data e hora de conclusão do onboarding';

-- Forçar atualização do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================
-- PARTE 6: Verificação Final
-- ============================================

SELECT 
  'user_roles' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 'plans', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'plans'
) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 'evolution_providers', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'evolution_providers'
) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 'lead_tags', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'lead_tags'
) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 'message_templates', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'message_templates'
) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 'instance_groups', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'instance_groups'
) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 'broadcast_campaigns', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'broadcast_campaigns'
) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 'broadcast_time_windows', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'broadcast_time_windows'
) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 'broadcast_campaign_templates', CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'broadcast_campaign_templates'
) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 'get_all_organizations_with_members', CASE WHEN EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_all_organizations_with_members'
) THEN '✅' ELSE '❌' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Após executar, recarregue a aplicação
-- Este script é seguro para executar múltiplas vezes


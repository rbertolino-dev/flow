-- ============================================
-- FIX CRÍTICO: Criar tabelas e colunas faltantes
-- Aplicar no Supabase SQL Editor
-- ============================================
-- Este script cria as tabelas/colunas que estão causando 404/400 no frontend
-- Baseado nas migrations oficiais do projeto

-- ============================================
-- 1. Adicionar colunas faltantes em leads
-- ============================================

-- organization_id (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.leads 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_leads_org ON public.leads(organization_id);
  END IF;
END $$;

-- call_count (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'call_count'
  ) THEN
    ALTER TABLE public.leads 
    ADD COLUMN call_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- excluded_from_funnel (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'excluded_from_funnel'
  ) THEN
    ALTER TABLE public.leads 
    ADD COLUMN excluded_from_funnel BOOLEAN DEFAULT false;
    
    CREATE INDEX IF NOT EXISTS idx_leads_excluded_funnel ON public.leads(excluded_from_funnel);
  END IF;
END $$;

-- deleted_at (se não existir - para soft delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.leads 
    ADD COLUMN deleted_at TIMESTAMPTZ;
    
    CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);
  END IF;
END $$;


-- ============================================
-- 2. Criar tabela pipeline_stages (se não existir)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pipeline_stages'
  ) THEN
    CREATE TABLE public.pipeline_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT '#3B82F6',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org ON public.pipeline_stages(organization_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_stages_position ON public.pipeline_stages(organization_id, position);

    ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

    -- Policies básicas
    CREATE POLICY "pipeline_stages_select_org_members"
    ON public.pipeline_stages
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = pipeline_stages.organization_id
      )
    );

    CREATE POLICY "pipeline_stages_manage_org_members"
    ON public.pipeline_stages
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = pipeline_stages.organization_id
          AND om.role IN ('owner', 'admin')
      )
    );
  END IF;
END $$;


-- ============================================
-- 3. Criar tabela tags (se não existir)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tags'
  ) THEN
    CREATE TABLE public.tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_tags_org ON public.tags(organization_id);

    ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

    -- Policies básicas
    CREATE POLICY "tags_select_org_members"
    ON public.tags
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = tags.organization_id
      )
    );

    CREATE POLICY "tags_manage_org_members"
    ON public.tags
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = tags.organization_id
          AND om.role IN ('owner', 'admin')
      )
    );
  END IF;
END $$;


-- ============================================
-- 4. Criar tabela products (se não existir)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'products'
  ) THEN
    CREATE TABLE public.products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      category TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by UUID REFERENCES public.profiles(id),
      updated_by UUID REFERENCES public.profiles(id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_organization ON public.products(organization_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
    CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);

    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view products of their organization"
    ON public.products FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = products.organization_id
      )
    );

    CREATE POLICY "Users can create products for their organization"
    ON public.products FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = products.organization_id
      )
    );

    CREATE POLICY "Users can update products of their organization"
    ON public.products FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = products.organization_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = products.organization_id
      )
    );

    CREATE POLICY "Users can delete products of their organization"
    ON public.products FOR DELETE
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = products.organization_id
      )
    );
  END IF;
END $$;


-- ============================================
-- 5. Criar tabela organization_limits (se não existir)
-- ============================================

-- Criar enum se não existir
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_limits'
  ) THEN
    CREATE TABLE public.organization_limits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      max_leads INTEGER DEFAULT NULL,
      max_evolution_instances INTEGER DEFAULT NULL,
      enabled_features public.organization_feature[] DEFAULT ARRAY[]::public.organization_feature[],
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by UUID REFERENCES auth.users(id),
      UNIQUE(organization_id)
    );

    CREATE INDEX IF NOT EXISTS idx_organization_limits_org ON public.organization_limits(organization_id);

    ALTER TABLE public.organization_limits ENABLE ROW LEVEL SECURITY;

    -- Policies simplificadas (sem dependência de funções que podem não existir)
    CREATE POLICY "org_limits_select_org_members"
    ON public.organization_limits
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_limits.organization_id
      )
    );

    CREATE POLICY "org_limits_manage_org_owners"
    ON public.organization_limits
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_limits.organization_id
          AND om.role = 'owner'
      )
    );
  END IF;
END $$;


-- ============================================
-- 6. Criar tabela organization_onboarding_progress (se não existir)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organization_onboarding_progress'
  ) THEN
    CREATE TABLE public.organization_onboarding_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      step_completed TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, step_completed)
    );

    CREATE INDEX IF NOT EXISTS idx_onboarding_progress_org ON public.organization_onboarding_progress(organization_id);
    CREATE INDEX IF NOT EXISTS idx_onboarding_progress_step ON public.organization_onboarding_progress(step_completed);

    ALTER TABLE public.organization_onboarding_progress ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view onboarding progress of their organization"
    ON public.organization_onboarding_progress FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_onboarding_progress.organization_id
      )
    );

    CREATE POLICY "Users can insert onboarding progress for their organization"
    ON public.organization_onboarding_progress FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_onboarding_progress.organization_id
      )
    );

    CREATE POLICY "Users can update onboarding progress of their organization"
    ON public.organization_onboarding_progress FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_onboarding_progress.organization_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_onboarding_progress.organization_id
      )
    );
  END IF;
END $$;


-- ============================================
-- 7. Criar tabela whatsapp_workflow_lists (se não existir)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_workflow_lists'
  ) THEN
    CREATE TABLE public.whatsapp_workflow_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      list_type TEXT NOT NULL DEFAULT 'list' CHECK (list_type IN ('list', 'single')),
      contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
      default_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_lists_org ON public.whatsapp_workflow_lists(organization_id);

    ALTER TABLE public.whatsapp_workflow_lists ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "workflow_lists_select_org_members"
    ON public.whatsapp_workflow_lists
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = whatsapp_workflow_lists.organization_id
      )
    );

    CREATE POLICY "workflow_lists_manage_org_members"
    ON public.whatsapp_workflow_lists
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = whatsapp_workflow_lists.organization_id
          AND om.role IN ('owner', 'admin')
      )
    );
  END IF;
END $$;


-- ============================================
-- 8. Verificar se evolution_config tem organization_id
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evolution_config'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.evolution_config 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_evolution_config_org ON public.evolution_config(organization_id);
  END IF;
END $$;


-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Após executar, recarregue o app e verifique se os erros 404/400 diminuíram




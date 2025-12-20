-- ============================================
-- FIX COMPLETO: Corrigir todos os erros de schema
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script corrige todos os erros 400/404/406 vistos no console

-- ============================================
-- 1. Adicionar user_id em pipeline_stages (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pipeline_stages'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.pipeline_stages 
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user ON public.pipeline_stages(user_id);
    
    -- Preencher user_id com o primeiro owner/admin da organização
    UPDATE public.pipeline_stages ps
    SET user_id = (
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id = ps.organization_id
        AND om.role IN ('owner', 'admin')
      ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END
      LIMIT 1
    )
    WHERE user_id IS NULL;
  END IF;
END $$;

-- ============================================
-- 2. Adicionar organization_id em call_queue (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'call_queue'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.call_queue 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_call_queue_org ON public.call_queue(organization_id);
  END IF;
END $$;

-- ============================================
-- 3. Corrigir products.is_active → products.active
-- ============================================
-- O frontend está usando is_active, mas a tabela tem active
-- Vamos adicionar is_active como alias ou renomear
DO $$
BEGIN
  -- Se existe active mas não is_active, criar is_active como alias via view ou adicionar coluna
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'is_active'
  ) THEN
    -- Adicionar is_active como coluna que espelha active
    ALTER TABLE public.products 
    ADD COLUMN is_active BOOLEAN GENERATED ALWAYS AS (active) STORED;
    
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
  END IF;
END $$;

-- ============================================
-- 4. Corrigir organization_limits: adicionar plan_id e foreign key
-- ============================================
-- Primeiro verificar se tabela plans existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plans'
  ) THEN
    CREATE TABLE public.plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      features JSONB DEFAULT '{}'::jsonb,
      price DECIMAL(10, 2),
      billing_period TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Inserir planos padrão
    INSERT INTO public.plans (name, description, features) VALUES
      ('free', 'Plano Gratuito', '{"leads": 100, "evolution_instances": 1}'::jsonb),
      ('starter', 'Plano Starter', '{"leads": 500, "evolution_instances": 3}'::jsonb),
      ('professional', 'Plano Professional', '{"leads": 5000, "evolution_instances": 10}'::jsonb),
      ('enterprise', 'Plano Enterprise', '{"leads": -1, "evolution_instances": -1}'::jsonb)
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

-- Adicionar plan_id em organization_limits se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_limits'
      AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.organization_limits 
    ADD COLUMN plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_org_limits_plan ON public.organization_limits(plan_id);
    
    -- Definir plan_id padrão como 'free' para organizações existentes
    UPDATE public.organization_limits ol
    SET plan_id = (SELECT id FROM public.plans WHERE name = 'free' LIMIT 1)
    WHERE plan_id IS NULL;
  END IF;
END $$;

-- ============================================
-- 5. Criar tabelas de configuração faltantes
-- ============================================

-- hubspot_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'hubspot_configs'
  ) THEN
    CREATE TABLE public.hubspot_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_hubspot_configs_org ON public.hubspot_configs(organization_id);
    ALTER TABLE public.hubspot_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "hubspot_configs_select_org_members"
    ON public.hubspot_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = hubspot_configs.organization_id
      )
    );
  END IF;
END $$;

-- gmail_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'gmail_configs'
  ) THEN
    CREATE TABLE public.gmail_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, user_id, email)
    );
    
    CREATE INDEX IF NOT EXISTS idx_gmail_configs_org ON public.gmail_configs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_gmail_configs_user ON public.gmail_configs(user_id);
    ALTER TABLE public.gmail_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "gmail_configs_select_org_members"
    ON public.gmail_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = gmail_configs.organization_id
      )
    );
  END IF;
END $$;

-- mercado_pago_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mercado_pago_configs'
  ) THEN
    CREATE TABLE public.mercado_pago_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      public_key TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_mercado_pago_configs_org ON public.mercado_pago_configs(organization_id);
    ALTER TABLE public.mercado_pago_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "mercado_pago_configs_select_org_members"
    ON public.mercado_pago_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = mercado_pago_configs.organization_id
      )
    );
  END IF;
END $$;

-- mercado_pago_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mercado_pago_payments'
  ) THEN
    CREATE TABLE public.mercado_pago_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      payment_id TEXT NOT NULL,
      status TEXT NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      currency TEXT DEFAULT 'BRL',
      payment_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(payment_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_org ON public.mercado_pago_payments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_status ON public.mercado_pago_payments(status);
    ALTER TABLE public.mercado_pago_payments ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "mercado_pago_payments_select_org_members"
    ON public.mercado_pago_payments FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = mercado_pago_payments.organization_id
      )
    );
  END IF;
END $$;

-- facebook_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'facebook_configs'
  ) THEN
    CREATE TABLE public.facebook_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      page_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, page_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_facebook_configs_org ON public.facebook_configs(organization_id);
    ALTER TABLE public.facebook_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "facebook_configs_select_org_members"
    ON public.facebook_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
    );
  END IF;
END $$;

-- bubble_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'bubble_configs'
  ) THEN
    CREATE TABLE public.bubble_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      api_key TEXT NOT NULL,
      app_url TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_bubble_configs_org ON public.bubble_configs(organization_id);
    ALTER TABLE public.bubble_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "bubble_configs_select_org_members"
    ON public.bubble_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = bubble_configs.organization_id
      )
    );
  END IF;
END $$;

-- asaas_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'asaas_configs'
  ) THEN
    CREATE TABLE public.asaas_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      api_key TEXT NOT NULL,
      environment TEXT DEFAULT 'production',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_asaas_configs_org ON public.asaas_configs(organization_id);
    ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "asaas_configs_select_org_members"
    ON public.asaas_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = asaas_configs.organization_id
      )
    );
  END IF;
END $$;

-- ============================================
-- 6. Garantir que evolution_config tem organization_id
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
-- Após executar, recarregue o app e os erros devem desaparecer


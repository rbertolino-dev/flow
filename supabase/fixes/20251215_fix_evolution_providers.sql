-- ============================================
-- FIX: Criar tabela evolution_providers e adicionar coluna evolution_provider_id
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script corrige os erros 404 e 400 relacionados a evolution_providers

-- ============================================
-- 0. Garantir que tipo organization_feature existe
-- ============================================
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
-- 1. Criar tabela evolution_providers (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'evolution_providers'
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

    -- Índices
    CREATE INDEX idx_evolution_providers_active ON public.evolution_providers(is_active) WHERE is_active = true;

    -- Habilitar RLS
    ALTER TABLE public.evolution_providers ENABLE ROW LEVEL SECURITY;

    -- Trigger para updated_at
    CREATE TRIGGER update_evolution_providers_updated_at
    BEFORE UPDATE ON public.evolution_providers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 2. Adicionar coluna evolution_provider_id em organization_limits (se não existir)
-- ============================================
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

-- ============================================
-- 3. Criar/atualizar políticas RLS para evolution_providers
-- ============================================
-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Super admins can view all evolution providers" ON public.evolution_providers;
DROP POLICY IF EXISTS "Super admins can manage all evolution providers" ON public.evolution_providers;
DROP POLICY IF EXISTS "Super admins can manage evolution providers" ON public.evolution_providers;

-- Política para SELECT (super admins podem ver tudo)
CREATE POLICY "Super admins can view all evolution providers"
ON public.evolution_providers
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Política para INSERT/UPDATE/DELETE (super admins podem gerenciar tudo)
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

-- ============================================
-- 4. Verificar resultado
-- ============================================
SELECT 
  'evolution_providers' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'evolution_providers'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'organization_limits.evolution_provider_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'evolution_provider_id'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- 5. Garantir que tabela plans existe e tem coluna is_active
-- ============================================
DO $$
BEGIN
  -- Verificar se tabela plans existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plans'
  ) THEN
    -- Criar tabela plans
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

    -- Políticas RLS
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

    -- Trigger para updated_at
    CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- Garantir que coluna is_active existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plans'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.plans
    ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================
-- 6. Verificar resultado final
-- ============================================
SELECT 
  'evolution_providers' as item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'evolution_providers'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'organization_limits.evolution_provider_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'evolution_provider_id'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'plans',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'plans'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'plans.is_active',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'is_active'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Após executar, recarregue a página do Super Admin


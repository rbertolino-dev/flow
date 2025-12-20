-- ============================================
-- FIX: Adicionar colunas faltantes em organization_limits
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Garantir que função update_updated_at_column existe
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Garantir que enum organization_feature existe e tem todos os valores
-- ============================================
-- Criar função auxiliar para adicionar valor ao enum se não existir
CREATE OR REPLACE FUNCTION public.add_enum_value_if_not_exists(
  _enum_type TEXT,
  _enum_value TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Verificar se o valor já existe no enum
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = _enum_value
      AND enumtypid = (
        SELECT oid
        FROM pg_type
        WHERE typname = _enum_type
      )
  ) INTO v_exists;
  
  -- Se não existe, adicionar
  IF NOT v_exists THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE %L', _enum_type, _enum_value);
  END IF;
END;
$$;

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

-- Adicionar valores faltantes ao enum (se não existirem)
DO $$
BEGIN
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'calendar_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'calendar');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'gmail_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'hubspot_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'payment_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'bubble_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'chatwoot_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'post_sale');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'automations');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'contracts');
END $$;

-- ============================================
-- 3. Criar tabela organization_limits se não existir
-- ============================================
CREATE TABLE IF NOT EXISTS public.organization_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  
  -- Limites numéricos
  max_leads INTEGER DEFAULT NULL,
  max_users INTEGER DEFAULT NULL,
  max_instances INTEGER DEFAULT NULL,
  max_evolution_instances INTEGER DEFAULT NULL,
  max_broadcasts_per_month INTEGER DEFAULT NULL,
  max_scheduled_messages_per_month INTEGER DEFAULT NULL,
  max_storage_gb NUMERIC(10,2) DEFAULT NULL,
  
  -- Contadores atuais
  current_leads_count INTEGER DEFAULT 0,
  current_users_count INTEGER DEFAULT 0,
  current_instances_count INTEGER DEFAULT 0,
  current_month_broadcasts INTEGER DEFAULT 0,
  current_month_scheduled INTEGER DEFAULT 0,
  current_storage_used_gb NUMERIC(10,2) DEFAULT 0,
  
  -- Funcionalidades (JSONB para override - formato mais recente)
  enabled_features JSONB DEFAULT '[]'::jsonb,
  disabled_features JSONB DEFAULT '[]'::jsonb,
  
  -- Trial e override
  trial_ends_at TIMESTAMPTZ DEFAULT NULL,
  features_override_mode TEXT DEFAULT 'inherit',
  
  -- Metadados
  notes TEXT,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Uma configuração por organização
  CONSTRAINT unique_organization_limits_org UNIQUE(organization_id)
);

-- ============================================
-- 4. Adicionar colunas faltantes se não existirem
-- ============================================
ALTER TABLE public.organization_limits
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_instances INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_evolution_instances INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_broadcasts_per_month INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_scheduled_messages_per_month INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_storage_gb NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_leads_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_users_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_instances_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_month_broadcasts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_month_scheduled INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_storage_used_gb NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS disabled_features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS features_override_mode TEXT DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ DEFAULT now();

-- Garantir que organization_id existe e é NOT NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.organization_limits 
    ADD COLUMN organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 5. Sincronizar max_instances e max_evolution_instances
-- ============================================
-- Se max_evolution_instances existe mas max_instances não, copiar valor
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'max_evolution_instances'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'max_instances'
  ) THEN
    -- Sincronizar valores existentes
    UPDATE public.organization_limits
    SET max_instances = max_evolution_instances
    WHERE max_instances IS NULL AND max_evolution_instances IS NOT NULL;
    
    UPDATE public.organization_limits
    SET max_evolution_instances = max_instances
    WHERE max_evolution_instances IS NULL AND max_instances IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- 6. Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_organization_limits_org ON public.organization_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_limits_plan ON public.organization_limits(plan_id);

-- ============================================
-- 7. RLS POLICIES
-- ============================================
ALTER TABLE public.organization_limits ENABLE ROW LEVEL SECURITY;

-- Policies para organization_limits
DROP POLICY IF EXISTS "Users can view limits from their org" ON public.organization_limits;
CREATE POLICY "Users can view limits from their org"
  ON public.organization_limits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_limits.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super admins can manage limits" ON public.organization_limits;
CREATE POLICY "Super admins can manage limits"
  ON public.organization_limits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND LOWER(o.name) LIKE '%pubdigital%'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND LOWER(o.name) LIKE '%pubdigital%'
    )
  );

-- ============================================
-- 8. Triggers para updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_organization_limits_updated_at ON public.organization_limits;
CREATE TRIGGER update_organization_limits_updated_at
  BEFORE UPDATE ON public.organization_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 9. Função para verificar se organização tem acesso a uma feature
-- ============================================
CREATE OR REPLACE FUNCTION public.organization_has_feature(
  _organization_id UUID,
  _feature TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_plan_features JSONB;
  v_is_in_trial BOOLEAN;
BEGIN
  -- Buscar limites da organização
  SELECT * INTO v_limits
  FROM public.organization_limits
  WHERE organization_id = _organization_id;
  
  -- Se não tem limites configurados, permitir acesso (padrão)
  IF v_limits IS NULL THEN
    RETURN true;
  END IF;
  
  -- Verificar se está em trial
  v_is_in_trial := v_limits.trial_ends_at IS NOT NULL AND v_limits.trial_ends_at > now();
  
  -- Se está em trial, permitir tudo
  IF v_is_in_trial THEN
    RETURN true;
  END IF;
  
  -- Verificar modo de override
  IF v_limits.features_override_mode = 'override' THEN
    -- Modo override: usar apenas enabled_features
    RETURN (v_limits.enabled_features ? _feature);
  ELSE
    -- Modo inherit: verificar se não está em disabled_features
    IF (v_limits.disabled_features ? _feature) THEN
      RETURN false;
    END IF;
    
    -- Se tem plano, verificar features do plano
    IF v_limits.plan_id IS NOT NULL THEN
      SELECT features INTO v_plan_features
      FROM public.plans
      WHERE id = v_limits.plan_id;
      
      IF v_plan_features IS NOT NULL AND jsonb_typeof(v_plan_features) = 'array' THEN
        RETURN (v_plan_features ? _feature);
      END IF;
    END IF;
    
    -- Verificar enabled_features (override positivo)
    IF (v_limits.enabled_features ? _feature) THEN
      RETURN true;
    END IF;
    
    -- Por padrão, permitir acesso
    RETURN true;
  END IF;
END;
$$;

-- ============================================
-- 10. Comentários explicativos
-- ============================================
COMMENT ON TABLE public.organization_limits IS 'Limites e funcionalidades por organização';
COMMENT ON COLUMN public.organization_limits.disabled_features IS 'Funcionalidades do plano desabilitadas (override) - formato JSONB array';
COMMENT ON COLUMN public.organization_limits.enabled_features IS 'Funcionalidades extras habilitadas além do plano (override) - formato JSONB array';
COMMENT ON COLUMN public.organization_limits.trial_ends_at IS 'Data fim do período trial (acesso completo temporário)';
COMMENT ON COLUMN public.organization_limits.features_override_mode IS 'inherit=herda do plano, override=usa apenas enabled_features';
COMMENT ON COLUMN public.organization_limits.max_instances IS 'Alias para max_evolution_instances (sincronizado automaticamente)';

-- ============================================
-- 11. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 12. Verificar resultado
-- ============================================
SELECT 
  'organization_limits' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'disabled_features'
  ) THEN '✅ disabled_features OK' ELSE '❌ disabled_features faltando' END as disabled_features
UNION ALL
SELECT 
  'organization_limits',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'enabled_features'
  ) THEN '✅ enabled_features OK' ELSE '❌ enabled_features faltando' END
UNION ALL
SELECT 
  'organization_limits',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'trial_ends_at'
  ) THEN '✅ trial_ends_at OK' ELSE '❌ trial_ends_at faltando' END
UNION ALL
SELECT 
  'organization_limits',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'features_override_mode'
  ) THEN '✅ features_override_mode OK' ELSE '❌ features_override_mode faltando' END
UNION ALL
SELECT 
  'organization_has_feature',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' 
      AND routine_name = 'organization_has_feature'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  'Função RPC' as disabled_features;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)


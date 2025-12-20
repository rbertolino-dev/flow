-- ============================================
-- FIX: Corrigir tabela plans - adicionar colunas faltantes
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
-- 2. Criar tabela plans se não existir
-- ============================================
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly', -- monthly, yearly
  max_leads INTEGER,
  max_users INTEGER,
  max_instances INTEGER,
  max_broadcasts_per_month INTEGER,
  max_scheduled_messages_per_month INTEGER,
  max_storage_gb NUMERIC(10,2),
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. Adicionar colunas faltantes se não existirem
-- ============================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS max_leads INTEGER,
  ADD COLUMN IF NOT EXISTS max_users INTEGER,
  ADD COLUMN IF NOT EXISTS max_instances INTEGER,
  ADD COLUMN IF NOT EXISTS max_broadcasts_per_month INTEGER,
  ADD COLUMN IF NOT EXISTS max_scheduled_messages_per_month INTEGER,
  ADD COLUMN IF NOT EXISTS max_storage_gb NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Garantir que name é NOT NULL e UNIQUE
DO $$
BEGIN
  -- Tornar name NOT NULL se não for
  BEGIN
    ALTER TABLE public.plans ALTER COLUMN name SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Já é NOT NULL, ignorar
    NULL;
  END;
  
  -- Criar constraint UNIQUE se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plans_name_key'
    AND conrelid = 'public.plans'::regclass
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_name_key UNIQUE (name);
  END IF;
END $$;

-- Garantir que price é NOT NULL
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.plans ALTER COLUMN price SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- ============================================
-- 4. Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plans_name ON public.plans(name);

-- ============================================
-- 5. RLS POLICIES
-- ============================================
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Policies para plans (permitir leitura para todos autenticados, escrita apenas para super admins)
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans"
  ON public.plans FOR SELECT
  USING (true); -- Todos podem ver planos

-- Policy para INSERT/UPDATE/DELETE - apenas super admins (pubdigital)
DROP POLICY IF EXISTS "Super admins can manage plans" ON public.plans;
CREATE POLICY "Super admins can manage plans"
  ON public.plans FOR ALL
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
-- 6. Triggers para updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_plans_updated_at ON public.plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7. Comentários explicativos
-- ============================================
COMMENT ON TABLE public.plans IS 'Planos de assinatura do sistema';
COMMENT ON COLUMN public.plans.max_broadcasts_per_month IS 'Limite de broadcasts por mês (NULL = ilimitado)';
COMMENT ON COLUMN public.plans.max_scheduled_messages_per_month IS 'Limite de mensagens agendadas por mês (NULL = ilimitado)';
COMMENT ON COLUMN public.plans.max_storage_gb IS 'Limite de armazenamento em GB (NULL = ilimitado)';
COMMENT ON COLUMN public.plans.features IS 'Array JSONB com features habilitadas no plano';
COMMENT ON COLUMN public.plans.is_active IS 'Indica se o plano está ativo e disponível para assinatura';

-- ============================================
-- 8. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 9. Verificar resultado
-- ============================================
SELECT 
  'plans' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'plans'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_broadcasts_per_month'
  ) THEN '✅ max_broadcasts_per_month OK' ELSE '❌ max_broadcasts_per_month faltando' END as coluna
UNION ALL
SELECT 
  'plans',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'plans'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_scheduled_messages_per_month'
  ) THEN '✅ max_scheduled_messages_per_month OK' ELSE '❌ max_scheduled_messages_per_month faltando' END
UNION ALL
SELECT 
  'plans',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'plans'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'is_active'
  ) THEN '✅ is_active OK' ELSE '❌ is_active faltando' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)


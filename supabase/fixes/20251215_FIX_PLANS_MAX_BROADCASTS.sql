-- ============================================
-- FIX: Adicionar coluna max_broadcasts_per_month na tabela plans
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Garantir que a tabela plans existe
-- ============================================
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly',
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
-- 2. Adicionar coluna max_broadcasts_per_month se não existir
-- ============================================
DO $$
BEGIN
  -- Verificar se a coluna existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_broadcasts_per_month'
  ) THEN
    -- Adicionar a coluna
    ALTER TABLE public.plans 
    ADD COLUMN max_broadcasts_per_month INTEGER;
    
    RAISE NOTICE 'Coluna max_broadcasts_per_month adicionada com sucesso';
  ELSE
    RAISE NOTICE 'Coluna max_broadcasts_per_month já existe';
  END IF;
END $$;

-- ============================================
-- 3. Adicionar outras colunas se não existirem
-- ============================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_scheduled_messages_per_month INTEGER,
  ADD COLUMN IF NOT EXISTS max_storage_gb NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================
-- 4. Forçar refresh do cache PostgREST (múltiplas vezes)
-- ============================================
NOTIFY pgrst, 'reload schema';

-- Aguardar um pouco e notificar novamente
DO $$
BEGIN
  PERFORM pg_sleep(1);
  NOTIFY pgrst, 'reload schema';
END $$;

-- ============================================
-- 5. Verificar se a coluna foi criada
-- ============================================
SELECT 
  'max_broadcasts_per_month' as coluna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_broadcasts_per_month'
  ) THEN '✅ Coluna existe' ELSE '❌ Coluna NÃO existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_broadcasts_per_month'
      AND data_type = 'integer'
  ) THEN '✅ Tipo correto (INTEGER)' ELSE '⚠️ Tipo incorreto' END as tipo
UNION ALL
SELECT 
  'max_scheduled_messages_per_month',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_scheduled_messages_per_month'
  ) THEN '✅ Coluna existe' ELSE '❌ Coluna NÃO existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_scheduled_messages_per_month'
      AND data_type = 'integer'
  ) THEN '✅ Tipo correto (INTEGER)' ELSE '⚠️ Tipo incorreto' END
UNION ALL
SELECT 
  'max_storage_gb',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_storage_gb'
  ) THEN '✅ Coluna existe' ELSE '❌ Coluna NÃO existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'plans' 
      AND column_name = 'max_storage_gb'
      AND data_type = 'numeric'
  ) THEN '✅ Tipo correto (NUMERIC)' ELSE '⚠️ Tipo incorreto' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- IMPORTANTE: 
-- 1. Execute este script
-- 2. AGUARDE 60-90 SEGUNDOS para o PostgREST atualizar o cache
-- 3. Recarregue a página com Ctrl+Shift+R (hard refresh)
-- 4. Se ainda não funcionar, aguarde mais 30 segundos e tente novamente


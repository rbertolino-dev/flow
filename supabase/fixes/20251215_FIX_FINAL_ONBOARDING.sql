-- ============================================
-- FIX FINAL: Corrigir todos os erros do onboarding
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script corrige TODOS os erros restantes de uma vez

-- ============================================
-- 1. Adicionar user_id em organization_onboarding_progress (usando ALTER TABLE direto)
-- ============================================
-- Usar ALTER TABLE direto para forçar atualização do cache

ALTER TABLE public.organization_onboarding_progress 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Atualizar registros existentes
UPDATE public.organization_onboarding_progress oop
SET user_id = (
  SELECT om.user_id 
  FROM public.organization_members om 
  WHERE om.organization_id = oop.organization_id 
  ORDER BY om.created_at ASC 
  LIMIT 1
)
WHERE user_id IS NULL;

-- Tornar NOT NULL após atualizar
ALTER TABLE public.organization_onboarding_progress 
ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- 2. Adicionar coluna max_instances em organization_limits (alias para max_evolution_instances)
-- ============================================
-- O código está usando max_instances mas a coluna correta é max_evolution_instances
-- Vamos adicionar max_instances como alias ou adicionar a coluna

-- Criar função para sincronizar max_instances (fora do bloco DO para evitar conflito de delimitadores)
CREATE OR REPLACE FUNCTION sync_max_instances()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Se max_evolution_instances mudou, atualizar max_instances
    IF NEW.max_evolution_instances IS DISTINCT FROM OLD.max_evolution_instances THEN
      NEW.max_instances := NEW.max_evolution_instances;
    END IF;
    -- Se max_instances mudou, atualizar max_evolution_instances
    IF NEW.max_instances IS DISTINCT FROM OLD.max_instances THEN
      NEW.max_evolution_instances := NEW.max_instances;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

-- Adicionar coluna max_instances se não existir
DO $$
BEGIN
  -- Verificar se max_instances existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'max_instances'
  ) THEN
    -- Adicionar coluna max_instances
    ALTER TABLE public.organization_limits 
    ADD COLUMN max_instances INTEGER;
    
    -- Sincronizar valores de max_evolution_instances para max_instances
    UPDATE public.organization_limits
    SET max_instances = max_evolution_instances
    WHERE max_instances IS NULL;
    
    -- Criar trigger para manter sincronizado
    DROP TRIGGER IF EXISTS sync_max_instances_trigger ON public.organization_limits;
    CREATE TRIGGER sync_max_instances_trigger
    BEFORE UPDATE ON public.organization_limits
    FOR EACH ROW
    EXECUTE FUNCTION sync_max_instances();
  END IF;
END $$;

-- ============================================
-- 3. Criar função organization_has_evolution_provider
-- ============================================
CREATE OR REPLACE FUNCTION public.organization_has_evolution_provider(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_limits ol
    WHERE ol.organization_id = _org_id
      AND ol.evolution_provider_id IS NOT NULL
  )
$$;

-- ============================================
-- 4. Verificar resultado
-- ============================================
SELECT 
  'organization_onboarding_progress.user_id' as item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_onboarding_progress' 
      AND column_name = 'user_id'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'organization_limits.max_instances',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_limits' 
      AND column_name = 'max_instances'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'organization_has_evolution_provider',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'organization_has_evolution_provider'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)


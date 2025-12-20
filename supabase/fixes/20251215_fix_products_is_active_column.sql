-- ============================================
-- FIX: Corrigir coluna is_active em products
-- Execute no Supabase SQL Editor
-- ============================================
-- O erro indica que is_active é uma coluna GENERATED, mas precisa ser normal

-- Verificar se a coluna existe e se é GENERATED
DO $$
BEGIN
  -- Verificar se coluna existe e é GENERATED
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'is_active'
      AND is_generated = 'ALWAYS'
  ) THEN
    -- Remover coluna GENERATED
    ALTER TABLE public.products DROP COLUMN is_active;
    
    -- Recriar como coluna normal
    ALTER TABLE public.products 
    ADD COLUMN is_active BOOLEAN DEFAULT true;
    
    RAISE NOTICE '✅ Coluna is_active recriada como coluna normal';
  ELSIF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'is_active'
  ) THEN
    -- Coluna existe mas pode não ter DEFAULT
    ALTER TABLE public.products 
    ALTER COLUMN is_active SET DEFAULT true;
    
    RAISE NOTICE '✅ Coluna is_active já existe, apenas ajustado DEFAULT';
  ELSE
    -- Coluna não existe, criar
    ALTER TABLE public.products 
    ADD COLUMN is_active BOOLEAN DEFAULT true;
    
    RAISE NOTICE '✅ Coluna is_active criada';
  END IF;
END $$;

-- Verificar resultado
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  is_generated,
  generation_expression
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'products' 
  AND column_name = 'is_active';

-- Se ainda for GENERATED, forçar remoção e recriação
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'is_active'
      AND is_generated = 'ALWAYS'
  ) THEN
    -- Forçar remoção
    ALTER TABLE public.products DROP COLUMN IF EXISTS is_active CASCADE;
    
    -- Recriar como normal
    ALTER TABLE public.products 
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    
    RAISE NOTICE '✅ Coluna is_active forçada a ser recriada';
  END IF;
END $$;

-- Verificação final
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'is_active'
        AND is_generated = 'NEVER'
    ) THEN '✅ Coluna is_active está correta (não é GENERATED)'
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'is_active'
    ) THEN '⚠️ Coluna is_active ainda é GENERATED - precisa correção manual'
    ELSE '❌ Coluna is_active não existe'
  END as status;


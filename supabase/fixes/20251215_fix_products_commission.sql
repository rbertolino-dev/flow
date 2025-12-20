-- ============================================
-- FIX: Adicionar colunas de comissão em products
-- Execute no Supabase SQL Editor
-- ============================================

-- Adicionar campos de comissão na tabela products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  ADD COLUMN IF NOT EXISTS commission_fixed DECIMAL(10, 2) DEFAULT 0 CHECK (commission_fixed >= 0);

-- Atualizar valores NULL para 0
UPDATE public.products
SET commission_percentage = COALESCE(commission_percentage, 0),
    commission_fixed = COALESCE(commission_fixed, 0)
WHERE commission_percentage IS NULL OR commission_fixed IS NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.products.commission_percentage IS 'Percentual de comissão sobre o valor do produto (0-100)';
COMMENT ON COLUMN public.products.commission_fixed IS 'Valor fixo de comissão por venda do produto';

-- Forçar refresh do cache PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificar resultado
SELECT 
  'products.commission_percentage' as item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'commission_percentage'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'products.commission_fixed',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'commission_fixed'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)

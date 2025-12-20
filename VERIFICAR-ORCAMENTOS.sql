-- SQL para verificar se as tabelas de orçamentos foram criadas corretamente
-- Execute no Supabase Dashboard → SQL Editor

-- 1. Verificar se as tabelas existem
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('budgets', 'budget_backgrounds')
ORDER BY table_name;

-- 2. Verificar estrutura da tabela budgets
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'budgets'
ORDER BY ordinal_position;

-- 3. Verificar estrutura da tabela budget_backgrounds
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'budget_backgrounds'
ORDER BY ordinal_position;

-- 4. Verificar índices criados
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'budget_backgrounds')
ORDER BY tablename, indexname;

-- 5. Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'budget_backgrounds')
ORDER BY tablename, policyname;

-- 6. Verificar se RLS está habilitado
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'budget_backgrounds');

-- 7. Verificar função generate_budget_number
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'generate_budget_number';

-- 8. Verificar triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
  AND event_object_table IN ('budgets', 'budget_backgrounds')
ORDER BY event_object_table, trigger_name;

-- 9. Contar registros (deve ser 0 se tudo estiver certo)
SELECT 
    'budgets' as tabela,
    COUNT(*) as total_registros
FROM public.budgets
UNION ALL
SELECT 
    'budget_backgrounds' as tabela,
    COUNT(*) as total_registros
FROM public.budget_backgrounds;

-- 10. Verificar foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('budgets', 'budget_backgrounds')
ORDER BY tc.table_name;



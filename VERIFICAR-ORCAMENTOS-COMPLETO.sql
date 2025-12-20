-- ============================================
-- VERIFICAÇÃO COMPLETA - SISTEMA DE ORÇAMENTOS
-- ============================================
-- Execute este SQL no Supabase Dashboard → SQL Editor
-- Data: 2025-12-20

-- ============================================
-- 1. VERIFICAR TABELAS
-- ============================================
SELECT 
    'TABELAS' as verificacao,
    table_name,
    CASE 
        WHEN table_name IN ('budgets', 'budget_backgrounds') THEN '✅ EXISTE'
        ELSE '❌ NÃO ENCONTRADA'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('budgets', 'budget_backgrounds')
ORDER BY table_name;

-- ============================================
-- 2. VERIFICAR COLUNAS DA TABELA BUDGETS
-- ============================================
SELECT 
    'COLUNAS BUDGETS' as verificacao,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('id', 'organization_id', 'budget_number', 'products', 'services', 'total') THEN '✅ OK'
        ELSE '⚠️ VERIFICAR'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'budgets'
ORDER BY ordinal_position;

-- ============================================
-- 3. VERIFICAR COLUNAS DA TABELA BUDGET_BACKGROUNDS
-- ============================================
SELECT 
    'COLUNAS BACKGROUNDS' as verificacao,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('id', 'organization_id', 'image_url') THEN '✅ OK'
        ELSE '⚠️ VERIFICAR'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'budget_backgrounds'
ORDER BY ordinal_position;

-- ============================================
-- 4. VERIFICAR ÍNDICES
-- ============================================
SELECT 
    'ÍNDICES' as verificacao,
    tablename,
    indexname,
    CASE 
        WHEN indexname LIKE 'idx_budgets%' OR indexname LIKE 'idx_budget_backgrounds%' THEN '✅ OK'
        ELSE '⚠️ VERIFICAR'
    END as status
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'budget_backgrounds')
ORDER BY tablename, indexname;

-- ============================================
-- 5. VERIFICAR POLÍTICAS RLS
-- ============================================
SELECT 
    'POLÍTICAS RLS' as verificacao,
    tablename,
    policyname,
    cmd as operacao,
    CASE 
        WHEN policyname LIKE '%budgets%' OR policyname LIKE '%backgrounds%' THEN '✅ OK'
        ELSE '⚠️ VERIFICAR'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'budget_backgrounds')
ORDER BY tablename, policyname;

-- ============================================
-- 6. VERIFICAR SE RLS ESTÁ HABILITADO
-- ============================================
SELECT 
    'RLS HABILITADO' as verificacao,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ HABILITADO'
        ELSE '❌ DESABILITADO'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'budget_backgrounds')
ORDER BY tablename;

-- ============================================
-- 7. VERIFICAR FUNÇÃO generate_budget_number
-- ============================================
SELECT 
    'FUNÇÃO' as verificacao,
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name = 'generate_budget_number' THEN '✅ EXISTE'
        ELSE '❌ NÃO ENCONTRADA'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'generate_budget_number';

-- ============================================
-- 8. VERIFICAR TRIGGERS
-- ============================================
SELECT 
    'TRIGGERS' as verificacao,
    event_object_table,
    trigger_name,
    event_manipulation,
    CASE 
        WHEN trigger_name LIKE '%budgets%' OR trigger_name LIKE '%backgrounds%' THEN '✅ OK'
        ELSE '⚠️ VERIFICAR'
    END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
  AND event_object_table IN ('budgets', 'budget_backgrounds')
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 9. VERIFICAR FOREIGN KEYS
-- ============================================
SELECT 
    'FOREIGN KEYS' as verificacao,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS tabela_referenciada,
    CASE 
        WHEN ccu.table_name IN ('organizations', 'leads', 'profiles') THEN '✅ OK'
        ELSE '⚠️ VERIFICAR'
    END as status
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

-- ============================================
-- 10. TESTE: CONTAR REGISTROS
-- ============================================
SELECT 
    'REGISTROS' as verificacao,
    'budgets' as tabela,
    COUNT(*) as total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ VAZIA (OK)'
        ELSE CONCAT('⚠️ TEM ', COUNT(*)::text, ' REGISTROS')
    END as status
FROM public.budgets
UNION ALL
SELECT 
    'REGISTROS' as verificacao,
    'budget_backgrounds' as tabela,
    COUNT(*) as total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ VAZIA (OK)'
        ELSE CONCAT('⚠️ TEM ', COUNT(*)::text, ' REGISTROS')
    END as status
FROM public.budget_backgrounds;

-- ============================================
-- 11. RESUMO FINAL
-- ============================================
SELECT 
    'RESUMO' as tipo,
    'Tabelas criadas' as item,
    COUNT(*)::text as valor,
    CASE 
        WHEN COUNT(*) = 2 THEN '✅ COMPLETO'
        ELSE CONCAT('⚠️ FALTAM ', (2 - COUNT(*))::text)
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('budgets', 'budget_backgrounds')
UNION ALL
SELECT 
    'RESUMO' as tipo,
    'Políticas RLS' as item,
    COUNT(*)::text as valor,
    CASE 
        WHEN COUNT(*) >= 8 THEN '✅ COMPLETO'
        ELSE CONCAT('⚠️ FALTAM ', (8 - COUNT(*))::text)
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('budgets', 'budget_backgrounds')
UNION ALL
SELECT 
    'RESUMO' as tipo,
    'Função generate_budget_number' as item,
    COUNT(*)::text as valor,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ EXISTE'
        ELSE '❌ NÃO ENCONTRADA'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'generate_budget_number';



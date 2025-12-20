-- ============================================
-- VERIFICAÇÃO RÁPIDA DAS CORREÇÕES
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Verificar políticas RLS de contracts (deve ter is_pubdigital_user)
SELECT 
    'contracts' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ CORRETO'
        ELSE '❌ FALTA pubdigital'
    END as status
FROM pg_policies 
WHERE tablename = 'contracts' 
  AND schemaname = 'public'
ORDER BY policyname;

-- 2. Verificar políticas RLS de contract_templates (deve ter is_pubdigital_user)
SELECT 
    'contract_templates' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ CORRETO'
        ELSE '❌ FALTA pubdigital'
    END as status
FROM pg_policies 
WHERE tablename = 'contract_templates' 
  AND schemaname = 'public'
ORDER BY policyname;

-- 3. Verificar políticas RLS de contract_signatures (deve ter is_pubdigital_user)
SELECT 
    'contract_signatures' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ CORRETO'
        ELSE '❌ FALTA pubdigital'
    END as status
FROM pg_policies 
WHERE tablename = 'contract_signatures' 
  AND schemaname = 'public'
ORDER BY policyname;

-- 4. Verificar se função is_pubdigital_user existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'is_pubdigital_user'
        ) THEN '✅ Função is_pubdigital_user existe'
        ELSE '❌ Função is_pubdigital_user NÃO existe'
    END as status_funcao;

-- 5. Verificar se função has_role existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'has_role'
        ) THEN '✅ Função has_role existe'
        ELSE '❌ Função has_role NÃO existe'
    END as status_funcao;

-- 6. Verificar se tabela contract_categories existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'contract_categories'
        ) THEN '✅ Tabela contract_categories existe'
        ELSE '❌ Tabela contract_categories NÃO existe'
    END as status_tabela;

-- 7. Verificar se coluna category_id existe em contracts
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'contracts' 
            AND column_name = 'category_id'
        ) THEN '✅ Coluna category_id existe em contracts'
        ELSE '❌ Coluna category_id NÃO existe em contracts'
    END as status_coluna;

-- 8. Contar contratos da organização pubdigital
SELECT 
    o.name as organizacao,
    COUNT(c.id) as total_contratos,
    COUNT(CASE WHEN c.status = 'draft' THEN 1 END) as rascunhos,
    COUNT(CASE WHEN c.status = 'sent' THEN 1 END) as enviados,
    COUNT(CASE WHEN c.status = 'signed' THEN 1 END) as assinados
FROM organizations o
LEFT JOIN contracts c ON c.organization_id = o.id
WHERE LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.name) LIKE '%pub%'
GROUP BY o.id, o.name
ORDER BY total_contratos DESC;

-- 9. Contar templates da organização pubdigital
SELECT 
    o.name as organizacao,
    COUNT(ct.id) as total_templates,
    COUNT(CASE WHEN ct.is_active = true THEN 1 END) as ativos
FROM organizations o
LEFT JOIN contract_templates ct ON ct.organization_id = o.id
WHERE LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.name) LIKE '%pub%'
GROUP BY o.id, o.name
ORDER BY total_templates DESC;

-- 10. Verificar tipos de reminder_type (deve incluir signature_due, expiration_approaching, follow_up)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contract_reminders'::regclass
  AND contype = 'c'
  AND conname LIKE '%reminder_type%';

-- 11. Verificar tipos de sent_via (deve incluir whatsapp, email, sms, system)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contract_reminders'::regclass
  AND contype = 'c'
  AND conname LIKE '%sent_via%';



-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Verificar políticas RLS de contracts (deve ter is_pubdigital_user)
SELECT 
    'contracts' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ CORRETO'
        ELSE '❌ FALTA pubdigital'
    END as status
FROM pg_policies 
WHERE tablename = 'contracts' 
  AND schemaname = 'public'
ORDER BY policyname;

-- 2. Verificar políticas RLS de contract_templates (deve ter is_pubdigital_user)
SELECT 
    'contract_templates' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ CORRETO'
        ELSE '❌ FALTA pubdigital'
    END as status
FROM pg_policies 
WHERE tablename = 'contract_templates' 
  AND schemaname = 'public'
ORDER BY policyname;

-- 3. Verificar políticas RLS de contract_signatures (deve ter is_pubdigital_user)
SELECT 
    'contract_signatures' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ CORRETO'
        ELSE '❌ FALTA pubdigital'
    END as status
FROM pg_policies 
WHERE tablename = 'contract_signatures' 
  AND schemaname = 'public'
ORDER BY policyname;

-- 4. Verificar se função is_pubdigital_user existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'is_pubdigital_user'
        ) THEN '✅ Função is_pubdigital_user existe'
        ELSE '❌ Função is_pubdigital_user NÃO existe'
    END as status_funcao;

-- 5. Verificar se função has_role existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'has_role'
        ) THEN '✅ Função has_role existe'
        ELSE '❌ Função has_role NÃO existe'
    END as status_funcao;

-- 6. Verificar se tabela contract_categories existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'contract_categories'
        ) THEN '✅ Tabela contract_categories existe'
        ELSE '❌ Tabela contract_categories NÃO existe'
    END as status_tabela;

-- 7. Verificar se coluna category_id existe em contracts
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'contracts' 
            AND column_name = 'category_id'
        ) THEN '✅ Coluna category_id existe em contracts'
        ELSE '❌ Coluna category_id NÃO existe em contracts'
    END as status_coluna;

-- 8. Contar contratos da organização pubdigital
SELECT 
    o.name as organizacao,
    COUNT(c.id) as total_contratos,
    COUNT(CASE WHEN c.status = 'draft' THEN 1 END) as rascunhos,
    COUNT(CASE WHEN c.status = 'sent' THEN 1 END) as enviados,
    COUNT(CASE WHEN c.status = 'signed' THEN 1 END) as assinados
FROM organizations o
LEFT JOIN contracts c ON c.organization_id = o.id
WHERE LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.name) LIKE '%pub%'
GROUP BY o.id, o.name
ORDER BY total_contratos DESC;

-- 9. Contar templates da organização pubdigital
SELECT 
    o.name as organizacao,
    COUNT(ct.id) as total_templates,
    COUNT(CASE WHEN ct.is_active = true THEN 1 END) as ativos
FROM organizations o
LEFT JOIN contract_templates ct ON ct.organization_id = o.id
WHERE LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.name) LIKE '%pub%'
GROUP BY o.id, o.name
ORDER BY total_templates DESC;

-- 10. Verificar tipos de reminder_type (deve incluir signature_due, expiration_approaching, follow_up)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contract_reminders'::regclass
  AND contype = 'c'
  AND conname LIKE '%reminder_type%';

-- 11. Verificar tipos de sent_via (deve incluir whatsapp, email, sms, system)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contract_reminders'::regclass
  AND contype = 'c'
  AND conname LIKE '%sent_via%';

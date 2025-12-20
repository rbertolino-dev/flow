-- ============================================
-- SCRIPT: Verificar Configuração do DeepSeek
-- ============================================
-- Execute este script para verificar se tudo está configurado corretamente

-- 1. Verificar se a tabela existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'assistant_config'
        ) THEN '✅ Tabela assistant_config existe'
        ELSE '❌ Tabela assistant_config NÃO existe'
    END as status_tabela;

-- 2. Verificar se o campo api_key existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'assistant_config' 
            AND column_name = 'api_key'
        ) THEN '✅ Campo api_key existe'
        ELSE '❌ Campo api_key NÃO existe'
    END as status_campo;

-- 3. Verificar configurações existentes
SELECT 
    id,
    organization_id,
    CASE 
        WHEN organization_id IS NULL THEN 'Global (todas organizações)'
        ELSE 'Organização específica'
    END as tipo_config,
    CASE 
        WHEN api_key IS NOT NULL THEN '✅ Configurada (' || LEFT(api_key, 8) || '...)'
        ELSE '❌ Não configurada (usa variável de ambiente)'
    END as status_api_key,
    model,
    temperature,
    max_tokens,
    is_active,
    is_global,
    created_at,
    updated_at
FROM public.assistant_config
ORDER BY 
    CASE WHEN is_global = true THEN 0 ELSE 1 END,
    updated_at DESC;

-- 4. Verificar índices
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'assistant_config'
ORDER BY indexname;

-- 5. Verificar políticas RLS
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'assistant_config'
ORDER BY policyname;

-- 6. Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'assistant_config';

-- 7. Resumo final
SELECT 
    'RESUMO DA CONFIGURAÇÃO' as titulo,
    (SELECT COUNT(*) FROM public.assistant_config) as total_configuracoes,
    (SELECT COUNT(*) FROM public.assistant_config WHERE api_key IS NOT NULL) as configs_com_api_key,
    (SELECT COUNT(*) FROM public.assistant_config WHERE is_global = true) as configs_globais,
    (SELECT COUNT(*) FROM public.assistant_config WHERE is_active = true) as configs_ativas;




-- ============================================
-- SCRIPT: Verificação Rápida - Deploy DeepSeek
-- ============================================
-- Execute este script no SQL Editor para verificar se tudo está configurado

-- 1. Verificar se as tabelas existem
SELECT 
  'Tabelas do Assistente' as verificacao,
  COUNT(*) as total,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ OK - Todas as tabelas existem'
    ELSE '❌ FALTANDO - ' || (3 - COUNT(*)) || ' tabela(s) não encontrada(s)'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions');

-- 2. Verificar se o campo api_key existe
SELECT 
  'Campo api_key' as verificacao,
  COUNT(*) as total,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ OK - Campo api_key existe'
    ELSE '❌ ERRO - Campo api_key não existe'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'assistant_config'
AND column_name = 'api_key';

-- 3. Verificar se API key está configurada
SELECT 
  'API Key Configurada' as verificacao,
  COUNT(*) as total,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ OK - API Key configurada'
    ELSE '❌ ERRO - API Key não configurada'
  END as status,
  MAX(CASE WHEN is_global = true THEN 'Global' ELSE 'Por organização' END) as tipo
FROM assistant_config
WHERE api_key IS NOT NULL;

-- 4. Verificar configurações ativas
SELECT 
  id,
  organization_id,
  CASE 
    WHEN organization_id IS NULL THEN '🌐 Global'
    ELSE '🏢 Organização: ' || LEFT(organization_id::text, 8) || '...'
  END as tipo,
  CASE 
    WHEN api_key IS NOT NULL THEN '✅ API Key configurada'
    ELSE '❌ Sem API Key'
  END as api_key_status,
  model,
  is_active,
  is_global,
  created_at,
  updated_at
FROM assistant_config
ORDER BY 
  CASE WHEN is_global = true THEN 0 ELSE 1 END,
  updated_at DESC;

-- 5. Resumo final
SELECT 
  'RESUMO FINAL' as titulo,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions')) as tabelas_existentes,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assistant_config' AND column_name = 'api_key') as campo_api_key,
  (SELECT COUNT(*) FROM assistant_config WHERE api_key IS NOT NULL) as api_keys_configuradas,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions')) = 3
     AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assistant_config' AND column_name = 'api_key') > 0
     AND (SELECT COUNT(*) FROM assistant_config WHERE api_key IS NOT NULL) > 0
    THEN '✅ TUDO PRONTO PARA PRODUÇÃO'
    ELSE '❌ VERIFIQUE OS ITENS ACIMA'
  END as status_final;




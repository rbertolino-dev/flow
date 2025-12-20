-- ============================================
-- HABILITAR EXTENSÃO HTTP PARA CRON JOBS
-- ============================================
-- Execute este SQL PRIMEIRO antes de criar os cron jobs
-- ============================================

-- Verificar extensões disponíveis
SELECT 
  extname as extensao,
  extversion as versao
FROM pg_extension
WHERE extname IN ('pg_cron', 'http', 'pg_net')
ORDER BY extname;

-- Tentar habilitar extensão http
CREATE EXTENSION IF NOT EXISTS http;

-- Se http não funcionar, tentar pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Verificar se foi habilitada
SELECT 
  extname as extensao,
  extversion as versao,
  CASE 
    WHEN extname = 'http' THEN '✅ Extensão http habilitada'
    WHEN extname = 'pg_net' THEN '✅ Extensão pg_net habilitada'
    ELSE '⚠️ Extensão não encontrada'
  END as status
FROM pg_extension
WHERE extname IN ('http', 'pg_net');

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- No Supabase Cloud, a extensão 'http' pode não estar disponível.
-- Nesse caso, você tem duas opções:
--
-- OPÇÃO 1: Usar pg_net (se disponível)
--   - Substituir net.http_post por net.http_post (mesma sintaxe)
--
-- OPÇÃO 2: Usar Edge Functions para chamar outras Edge Functions
--   - Criar uma Edge Function intermediária que faz as chamadas HTTP
--   - Os cron jobs chamam essa função intermediária
--
-- OPÇÃO 3: Usar Supabase Scheduled Functions (recomendado)
--   - Configurar via Dashboard → Database → Cron Jobs
--   - Mais simples e gerenciado pelo Supabase
-- ============================================




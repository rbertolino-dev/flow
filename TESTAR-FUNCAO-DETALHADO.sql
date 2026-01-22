-- ============================================
-- Testar Função com Detalhes Completos
-- ============================================
-- Este script testa a função e mostra resposta completa
-- ============================================

-- 1. Verificar se função está deployada (teste HTTP direto)
SELECT 
  'Teste HTTP Direto' as tipo,
  status_code,
  content::text as resposta
FROM http((
  'POST',
  'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
  ARRAY[
    http_header('Content-Type', 'application/json'),
    http_header('Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm')
  ],
  'application/json',
  '{}'
)::http_request);

-- 2. Testar com net.http_post (como o cron faz)
SELECT 
  'Teste net.http_post' as tipo,
  net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
    ),
    body := '{}'::jsonb
  ) as resultado;

-- 3. Verificar se query encontra a campanha (mesma query da função)
SELECT 
  'Query da Função' as tipo,
  id,
  name,
  status,
  scheduled_start_at,
  NOW() as agora,
  scheduled_start_at <= NOW() as deve_processar,
  CASE 
    WHEN status = 'draft' 
      AND scheduled_start_at IS NOT NULL 
      AND scheduled_start_at <= NOW() 
    THEN '✅ Deve ser processada'
    ELSE '❌ Não deve ser processada'
  END as diagnostico
FROM broadcast_campaigns
WHERE status = 'draft'
  AND scheduled_start_at IS NOT NULL
  AND scheduled_start_at <= NOW()
ORDER BY scheduled_start_at ASC
LIMIT 10;

-- 4. Verificar status da campanha após teste
SELECT 
  'Status da Campanha' as tipo,
  id,
  name,
  status,
  scheduled_start_at,
  started_at,
  CASE 
    WHEN status = 'running' THEN '✅ Iniciou!'
    WHEN status = 'draft' AND started_at IS NULL THEN '❌ Ainda não iniciou'
    ELSE '❓ Status: ' || status
  END as resultado
FROM broadcast_campaigns
WHERE id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80';

-- ============================================
-- INTERPRETAÇÃO:
-- ============================================
-- Se query 1 mostrar status_code diferente de 200:
--   → Problema com chamada HTTP
--   → Verificar URL ou autenticação
--
-- Se query 3 mostrar "Deve ser processada" mas query 4
-- ainda mostrar "Ainda não iniciou":
--   → Função não está processando
--   → Verificar logs da edge function no Dashboard
--
-- Se query 3 não mostrar a campanha:
--   → Query não está encontrando
--   → Verificar timezone ou condições
-- ============================================

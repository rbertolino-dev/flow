-- ============================================
-- Testar Função Manualmente
-- ============================================
-- Este script testa a função process-scheduled-campaigns manualmente
-- para ver se ela processa a campanha
-- ============================================

-- 1. Verificar status ANTES do teste
SELECT 
  'ANTES' as momento,
  id,
  name,
  status,
  scheduled_start_at,
  started_at
FROM broadcast_campaigns
WHERE id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80';

-- 2. Chamar função manualmente
SELECT net.http_post(
  url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
  ),
  body := '{}'::jsonb
) as resultado_teste;

-- 3. Aguardar 2 segundos e verificar status DEPOIS
-- (Execute esta query DEPOIS de executar a query 2)
SELECT 
  'DEPOIS' as momento,
  id,
  name,
  status,
  scheduled_start_at,
  started_at,
  CASE 
    WHEN status = 'running' THEN '✅ Campanha iniciou!'
    WHEN status = 'draft' AND started_at IS NULL THEN '❌ Ainda não iniciou'
    ELSE '❓ Status: ' || status
  END as resultado
FROM broadcast_campaigns
WHERE id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80';

-- 4. Verificar se query da função encontra a campanha
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
WHERE id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80';

-- ============================================
-- INSTRUÇÕES:
-- ============================================
-- 1. Execute a query 1 (ver status ANTES)
-- 2. Execute a query 2 (chamar função manualmente)
-- 3. Aguarde 2-3 segundos
-- 4. Execute a query 3 (ver status DEPOIS)
-- 5. Execute a query 4 (verificar se query encontra)
--
-- Se query 4 mostrar "Deve ser processada" mas query 3
-- ainda mostrar "Ainda não iniciou", há problema na função.
-- ============================================

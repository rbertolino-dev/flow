-- ============================================
-- VERIFICAÇÃO DETALHADA DO CRON JOB
-- ============================================
-- Verificar comando completo e últimas execuções
-- ============================================

-- 1. VER COMANDO COMPLETO DO CRON JOB
-- ============================================
SELECT 
  '--- COMANDO COMPLETO DO CRON JOB ---' as info;

SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command,
  LENGTH(command) as tamanho_comando
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';

-- 2. VER ÚLTIMAS 10 EXECUÇÕES COM DETALHES
-- ============================================
SELECT 
  '--- ÚLTIMAS 10 EXECUÇÕES ---' as info;

SELECT 
  jrd.runid,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message,
  CASE 
    WHEN jrd.status = 'succeeded' THEN '✅ Sucesso'
    WHEN jrd.status = 'failed' THEN '❌ Falhou'
    WHEN jrd.status = 'running' THEN '🔄 Em execução'
    ELSE '⚠️ ' || jrd.status
  END as resultado,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) as duracao_segundos
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-broadcast-queue'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- 3. VERIFICAR SE HÁ ERROS NAS ÚLTIMAS EXECUÇÕES
-- ============================================
SELECT 
  '--- ERROS NAS ÚLTIMAS EXECUÇÕES ---' as info;

SELECT 
  jrd.start_time,
  jrd.status,
  jrd.return_message,
  LEFT(jrd.return_message, 200) as mensagem_erro
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-broadcast-queue'
  AND jrd.status = 'failed'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- 4. VERIFICAR ITENS QUE DEVERIAM SER PROCESSADOS
-- ============================================
SELECT 
  '--- ITENS PRONTOS PARA ENVIO ---' as info;

SELECT 
  COUNT(*) as total_agendados,
  COUNT(*) FILTER (WHERE scheduled_for <= NOW()) as prontos_agora,
  COUNT(*) FILTER (WHERE scheduled_for > NOW()) as agendados_futuro,
  MIN(scheduled_for) FILTER (WHERE scheduled_for <= NOW()) as mais_antigo_pronto,
  MAX(scheduled_for) as mais_recente_agendamento
FROM broadcast_queue
WHERE status = 'scheduled';

-- 5. VER DETALHES DOS ITENS PRONTOS (Top 10)
-- ============================================
SELECT 
  '--- DETALHES: Itens Prontos para Envio (Top 10) ---' as info;

SELECT 
  bq.id,
  bq.campaign_id,
  bc.name as campaign_name,
  bc.status as campaign_status,
  bq.status,
  bq.scheduled_for,
  NOW() as current_time,
  ROUND(EXTRACT(EPOCH FROM (NOW() - bq.scheduled_for)) / 60, 2) as minutos_atraso,
  bq.phone,
  bq.name as contact_name
FROM broadcast_queue bq
JOIN broadcast_campaigns bc ON bc.id = bq.campaign_id
WHERE bq.status = 'scheduled'
  AND bq.scheduled_for <= NOW()
  AND bc.status = 'running'
ORDER BY bq.scheduled_for ASC
LIMIT 10;

-- 6. VERIFICAR SE A CHAVE ESTÁ CORRETA (SERVICE_ROLE_KEY vs PUBLISHABLE)
-- ============================================
SELECT 
  '--- VERIFICAÇÃO: Tipo de Chave no Comando ---' as info;

SELECT 
  CASE 
    WHEN command LIKE '%sb_publishable%' THEN 
      '⚠️ PROBLEMA: Usando chave PUBLISHABLE (deveria ser SERVICE_ROLE_KEY)'
    WHEN command LIKE '%Bearer [SERVICE_ROLE_KEY]%' THEN 
      '⚠️ PROBLEMA: Placeholder não substituído'
    WHEN command LIKE '%Bearer eyJ%' THEN 
      '✅ Usando chave JWT (provavelmente SERVICE_ROLE_KEY)'
    ELSE 
      '⚠️ Verificar manualmente o tipo de chave'
  END as status_chave,
  CASE 
    WHEN command LIKE '%sb_publishable%' THEN 
      '❌ Chave publishable NÃO tem permissão para chamar edge functions com SERVICE_ROLE_KEY'
    WHEN command LIKE '%Bearer [SERVICE_ROLE_KEY]%' THEN 
      '❌ Placeholder precisa ser substituído pela chave real'
    ELSE 
      '✅ Chave parece estar configurada'
  END as explicacao
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';

-- 7. VERIFICAR URL DA EDGE FUNCTION
-- ============================================
SELECT 
  '--- VERIFICAÇÃO: URL da Edge Function ---' as info;

SELECT 
  CASE 
    WHEN command LIKE '%ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue%' THEN 
      '✅ URL correta'
    WHEN command LIKE '%process-broadcast-queue%' THEN 
      '⚠️ URL pode estar incorreta - verificar'
    ELSE 
      '❌ URL não encontrada no comando'
  END as status_url
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';


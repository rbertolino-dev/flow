-- ============================================
-- DIAGNÓSTICO: Campanhas Agendadas Não Enviam
-- ============================================
-- Este script verifica todos os pontos críticos
-- que podem impedir o envio de campanhas agendadas
-- ============================================

-- 1. VERIFICAR SE CRON JOB ESTÁ CONFIGURADO
-- ============================================
SELECT 
  '1. CRON JOB' as verificacao,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job 
      WHERE jobname = 'process-broadcast-queue'
    ) THEN '✅ Cron job existe'
    ELSE '❌ Cron job NÃO existe - EXECUTAR: scripts/configurar-cron-jobs.sql'
  END as status
UNION ALL

-- 2. VERIFICAR SE CRON JOB ESTÁ ATIVO
-- ============================================
SELECT 
  '2. CRON JOB ATIVO' as verificacao,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job 
      WHERE jobname = 'process-broadcast-queue' 
        AND active = true
    ) THEN '✅ Cron job está ativo'
    ELSE '❌ Cron job está INATIVO - Ativar com: SELECT cron.alter_job(jobid, active => true)'
  END as status
UNION ALL

-- 3. VERIFICAR ÚLTIMAS EXECUÇÕES DO CRON JOB
-- ============================================
SELECT 
  '3. ÚLTIMA EXECUÇÃO' as verificacao,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job_run_details jrd
      JOIN cron.job j ON j.jobid = jrd.jobid
      WHERE j.jobname = 'process-broadcast-queue'
        AND jrd.start_time > NOW() - INTERVAL '1 hour'
    ) THEN '✅ Cron job executou na última hora'
    ELSE '❌ Cron job NÃO executou na última hora - Verificar logs'
  END as status
UNION ALL

-- 4. VERIFICAR EXTENSÕES NECESSÁRIAS
-- ============================================
SELECT 
  '4. EXTENSÃO pg_cron' as verificacao,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_extension 
      WHERE extname = 'pg_cron'
    ) THEN '✅ Extensão pg_cron habilitada'
    ELSE '❌ Extensão pg_cron NÃO habilitada - Executar: CREATE EXTENSION IF NOT EXISTS pg_cron'
  END as status
UNION ALL

SELECT 
  '5. EXTENSÃO net.http' as verificacao,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_extension 
      WHERE extname = 'http'
    ) THEN '✅ Extensão http habilitada'
    ELSE '❌ Extensão http NÃO habilitada - Executar: CREATE EXTENSION IF NOT EXISTS http'
  END as status
UNION ALL

-- 6. VERIFICAR ITENS AGENDADOS QUE DEVERIAM SER PROCESSADOS
-- ============================================
SELECT 
  '6. ITENS PRONTOS' as verificacao,
  CASE 
    WHEN COUNT(*) > 0 THEN 
      '✅ ' || COUNT(*) || ' itens prontos para envio (scheduled_for <= NOW())'
    ELSE 
      '⚠️ Nenhum item pronto para envio AGORA (mas pode haver itens agendados para o futuro)'
  END as status
FROM broadcast_queue
WHERE status = 'scheduled'
  AND scheduled_for <= NOW()
UNION ALL

-- 7. VERIFICAR CAMPANHAS RUNNING COM ITENS AGENDADOS
-- ============================================
SELECT 
  '7. CAMPANHAS RUNNING' as verificacao,
  CASE 
    WHEN COUNT(*) > 0 THEN 
      '✅ ' || COUNT(*) || ' campanha(s) running com itens agendados'
    ELSE 
      '⚠️ Nenhuma campanha running com itens agendados'
  END as status
FROM broadcast_campaigns bc
WHERE bc.status = 'running'
  AND EXISTS (
    SELECT 1 FROM broadcast_queue bq
    WHERE bq.campaign_id = bc.id
      AND bq.status = 'scheduled'
  );

-- ============================================
-- DETALHES: Últimas Execuções do Cron Job
-- ============================================
SELECT 
  '--- DETALHES: Últimas Execuções do Cron Job ---' as info;

SELECT 
  jrd.runid,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message,
  CASE 
    WHEN jrd.status = 'succeeded' THEN '✅ Sucesso'
    WHEN jrd.status = 'failed' THEN '❌ Falhou'
    ELSE '⚠️ ' || jrd.status
  END as resultado
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-broadcast-queue'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- ============================================
-- DETALHES: Itens Agendados por Campanha
-- ============================================
SELECT 
  '--- DETALHES: Campanhas Running com Itens Agendados ---' as info;

SELECT 
  bc.id as campaign_id,
  bc.name as campaign_name,
  bc.status as campaign_status,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for <= NOW()) as prontos_agora,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for > NOW()) as agendados_futuro,
  COUNT(bq.id) FILTER (WHERE bq.status = 'sent') as enviados,
  COUNT(bq.id) FILTER (WHERE bq.status = 'failed') as falhas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'pending') as pendentes,
  MIN(bq.scheduled_for) FILTER (WHERE bq.status = 'scheduled') as primeiro_agendamento,
  MAX(bq.scheduled_for) FILTER (WHERE bq.status = 'scheduled') as ultimo_agendamento
FROM broadcast_campaigns bc
LEFT JOIN broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.status = 'running'
GROUP BY bc.id, bc.name, bc.status
HAVING COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled') > 0
ORDER BY bc.created_at DESC;

-- ============================================
-- DETALHES: Itens Prontos para Envio (Top 20)
-- ============================================
SELECT 
  '--- DETALHES: Itens Prontos para Envio (Top 20) ---' as info;

SELECT 
  bq.id,
  bq.campaign_id,
  bc.name as campaign_name,
  bq.status,
  bq.scheduled_for,
  NOW() as current_time,
  EXTRACT(EPOCH FROM (NOW() - bq.scheduled_for)) / 60 as minutos_atraso,
  bq.phone,
  bq.name as contact_name
FROM broadcast_queue bq
JOIN broadcast_campaigns bc ON bc.id = bq.campaign_id
WHERE bq.status = 'scheduled'
  AND bq.scheduled_for <= NOW()
  AND bc.status = 'running'
ORDER BY bq.scheduled_for ASC
LIMIT 20;

-- ============================================
-- VERIFICAÇÃO: Configuração do Cron Job
-- ============================================
SELECT 
  '--- CONFIGURAÇÃO DO CRON JOB ---' as info;

SELECT 
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  j.command
FROM cron.job j
WHERE j.jobname = 'process-broadcast-queue';

-- ============================================
-- RESUMO FINAL
-- ============================================
SELECT 
  '--- RESUMO FINAL ---' as info;

SELECT 
  'Total de itens agendados' as metrica,
  COUNT(*)::text as valor
FROM broadcast_queue
WHERE status = 'scheduled'
UNION ALL
SELECT 
  'Itens prontos para envio AGORA' as metrica,
  COUNT(*)::text as valor
FROM broadcast_queue
WHERE status = 'scheduled'
  AND scheduled_for <= NOW()
UNION ALL
SELECT 
  'Campanhas running' as metrica,
  COUNT(*)::text as valor
FROM broadcast_campaigns
WHERE status = 'running'
UNION ALL
SELECT 
  'Cron job configurado' as metrica,
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-broadcast-queue') 
    THEN 'Sim' 
    ELSE 'NÃO - EXECUTAR: scripts/configurar-cron-jobs.sql'
  END as valor
UNION ALL
SELECT 
  'Cron job ativo' as metrica,
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-broadcast-queue' AND active = true) 
    THEN 'Sim' 
    ELSE 'NÃO - Ativar com: SELECT cron.alter_job(jobid, active => true)'
  END as valor
UNION ALL
SELECT 
  'Última execução (horas atrás)' as metrica,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job_run_details jrd
      JOIN cron.job j ON j.jobid = jrd.jobid
      WHERE j.jobname = 'process-broadcast-queue'
    ) THEN (
      SELECT EXTRACT(EPOCH FROM (NOW() - MAX(jrd.start_time))) / 3600
      FROM cron.job_run_details jrd
      JOIN cron.job j ON j.jobid = jrd.jobid
      WHERE j.jobname = 'process-broadcast-queue'
    )::text || ' horas'
    ELSE 'Nunca executou'
  END as valor;


-- Diagnóstico completo: campanha vs logs vs timezone
WITH campanha_atual AS (
  SELECT 
    id,
    name,
    status,
    scheduled_start_at,
    scheduled_start_at AT TIME ZONE 'America/Sao_Paulo' as scheduled_start_at_brt,
    created_at,
    created_at AT TIME ZONE 'America/Sao_Paulo' as created_at_brt
  FROM broadcast_campaigns
  WHERE status = 'draft'
    AND scheduled_start_at IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
),
horario_atual AS (
  SELECT 
    NOW() as agora_utc,
    NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brt,
    EXTRACT(EPOCH FROM NOW()) as timestamp_utc
),
ultima_execucao AS (
  SELECT 
    jrd.start_time,
    jrd.start_time AT TIME ZONE 'America/Sao_Paulo' as start_time_brt,
    jrd.status,
    jrd.return_message
  FROM cron.job_run_details jrd
  INNER JOIN cron.job j ON jrd.jobid = j.jobid
  WHERE j.jobname = 'process-scheduled-campaigns'
  ORDER BY jrd.start_time DESC
  LIMIT 1
)
SELECT 
  '📋 CAMPANHA' as tipo,
  c.id::text as id,
  c.name as nome,
  c.status::text as status,
  c.scheduled_start_at::text as agendado_utc,
  c.scheduled_start_at_brt::text as agendado_brt,
  c.created_at::text as criado_utc,
  c.created_at_brt::text as criado_brt,
  NULL::text as execucao_utc,
  NULL::text as execucao_brt,
  NULL::text as status_execucao,
  NULL::text as mensagem
FROM campanha_atual c
UNION ALL
SELECT 
  '⏰ HORÁRIO ATUAL' as tipo,
  NULL::text as id,
  NULL::text as nome,
  NULL::text as status,
  NULL::text as agendado_utc,
  NULL::text as agendado_brt,
  NULL::text as criado_utc,
  NULL::text as criado_brt,
  h.agora_utc::text as execucao_utc,
  h.agora_brt::text as execucao_brt,
  NULL::text as status_execucao,
  NULL::text as mensagem
FROM horario_atual h
UNION ALL
SELECT 
  '🔄 ÚLTIMA EXECUÇÃO' as tipo,
  NULL::text as id,
  NULL::text as nome,
  NULL::text as status,
  NULL::text as agendado_utc,
  NULL::text as agendado_brt,
  NULL::text as criado_utc,
  NULL::text as criado_brt,
  u.start_time::text as execucao_utc,
  u.start_time_brt::text as execucao_brt,
  u.status::text as status_execucao,
  u.return_message::text as mensagem
FROM ultima_execucao u
UNION ALL
SELECT 
  '🔍 ANÁLISE' as tipo,
  CASE 
    WHEN c.scheduled_start_at IS NULL THEN 'Sem agendamento'
    WHEN c.scheduled_start_at <= h.agora_utc THEN '✅ DEVERIA TER SIDO PROCESSADA'
    ELSE '⏳ AINDA NÃO CHEGOU O HORÁRIO'
  END::text as id,
  NULL::text as nome,
  NULL::text as status,
  NULL::text as agendado_utc,
  NULL::text as agendado_brt,
  NULL::text as criado_utc,
  NULL::text as criado_brt,
  NULL::text as execucao_utc,
  NULL::text as execucao_brt,
  NULL::text as status_execucao,
  ROUND(EXTRACT(EPOCH FROM (h.agora_utc - c.scheduled_start_at)) / 60, 2)::text || ' minutos de diferença' as mensagem
FROM campanha_atual c, horario_atual h;

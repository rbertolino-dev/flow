-- ============================================
-- VERIFICAR CRON JOBS CRIADOS
-- ============================================
-- Execute este SQL no SQL Editor para verificar
-- se os cron jobs foram criados corretamente
-- ============================================

-- 1. Contar total de cron jobs
SELECT COUNT(*) as total_jobs FROM cron.job;

-- 2. Listar todos os cron jobs com detalhes
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobid;

-- 3. Verificar se extensões estão habilitadas
SELECT 
  extname as extensao,
  extversion as versao
FROM pg_extension
WHERE extname IN ('pg_cron', 'http')
ORDER BY extname;

-- 4. Ver histórico de execuções (últimas 20)
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- ============================================
-- CRON JOBS ESPERADOS (7 no total):
-- ============================================
-- 1. sync-daily-metrics (0 0 * * *)
-- 2. process-whatsapp-workflows (*/5 * * * *)
-- 3. process-broadcast-queue (*/1 * * * *)
-- 4. process-scheduled-messages (*/1 * * * *)
-- 5. process-status-schedule (*/5 * * * *)
-- 6. sync-google-calendar-events (*/15 * * * *)
-- 7. process-google-business-posts (*/30 * * * *)
-- ============================================




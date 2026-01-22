-- ============================================
-- Verificar Execuções do Cron Job
-- ============================================
-- Execute este script SEPARADAMENTE se quiser ver
-- as últimas execuções do cron job
-- ============================================

-- Verificar últimas execuções do cron job
SELECT 
  start_time,
  end_time,
  status,
  return_message,
  jobid
FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid 
  FROM cron.job 
  WHERE jobname = 'process-scheduled-campaigns'
)
ORDER BY start_time DESC 
LIMIT 10;

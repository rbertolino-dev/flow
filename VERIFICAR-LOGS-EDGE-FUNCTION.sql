-- Verificar últimas execuções do cron job
SELECT 
  jobid,
  jobname,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time,
  start_time AT TIME ZONE 'America/Sao_Paulo' as start_time_brt,
  end_time AT TIME ZONE 'America/Sao_Paulo' as end_time_brt,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duracao_segundos
FROM cron.job_run_details
WHERE jobname = 'process-scheduled-campaigns'
ORDER BY start_time DESC
LIMIT 10;

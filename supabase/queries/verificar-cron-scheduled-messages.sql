-- Verificação: cron process-scheduled-messages + pending atrasadas
-- Supabase → SQL Editor

-- 1) Job existe?
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'process-scheduled-messages';

-- 2) Últimas execuções (se a tabela não existir na instância, ignorar este bloco)
SELECT jobid, runid, job_pid, database, username, command, status, return_message,
       start_time, end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-messages')
ORDER BY start_time DESC
LIMIT 15;

-- 3) Service role no Postgres (vazio → cron chama edge sem auth → 401)
SELECT length(current_setting('app.settings.service_role_key', true)) AS service_role_key_length;

-- 4) Pending já devidas
SELECT id, phone, scheduled_for, NOW() AS agora,
       EXTRACT(EPOCH FROM (NOW() - scheduled_for::timestamptz)) / 60 AS minutos_atraso,
       instance_id, organization_id, status, error_message
FROM scheduled_messages
WHERE status = 'pending'
  AND scheduled_for <= NOW()
ORDER BY scheduled_for ASC
LIMIT 50;

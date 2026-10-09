-- Cron isolado: monitor global de conexões WhatsApp (todas as orgs, sem QR)
-- Requer: app.settings.service_role_key + extensões pg_cron e http (ou net.http)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

DO $$
DECLARE
  jid bigint;
BEGIN
  LOOP
    SELECT jobid INTO jid FROM cron.job WHERE jobname = 'monitor-evolution-connections' ORDER BY jobid LIMIT 1;
    EXIT WHEN jid IS NULL;
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'monitor-evolution-connections',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/monitor-evolution-connections-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'apikey', current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'monitor-evolution-connections';

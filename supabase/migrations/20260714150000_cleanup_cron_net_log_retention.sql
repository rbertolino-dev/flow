-- Retenção automática: evita novo estouro de Disk IO por logs de cron/pg_net.
-- Política (modo seguro):
--   - cron.job_run_details: manter 7 dias
--   - net._http_response: manter 2 dias
-- Idempotente: recreia o job pelo nome.

DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job WHERE jobname = 'cleanup-cron-and-net-logs'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-cron-and-net-logs',
  '15 3 * * *',
  $cmd$
  DELETE FROM cron.job_run_details
  WHERE start_time < now() - interval '7 days';

  DELETE FROM net._http_response
  WHERE created < now() - interval '2 days';
  $cmd$
);

-- ============================================
-- CRON JOBS — cópia para colar no SQL Editor
-- (conteúdo idêntico a scripts/configurar-cron-jobs-completo.sql)
-- ============================================
--
-- ANTES DE CORRER ESTE SCRIPT (uma vez), defina a service role no Postgres
-- para o cron conseguir autenticar nas Edge Functions:
--
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'cole_aqui_o_JWT_service_role';
--
-- Obter o JWT: Dashboard → Project Settings → API → service_role (secret).
-- Sem isto, current_setting(...) fica vazio e as chamadas falham (401).
--
-- SOBRE O QUE VISTE NO SELECT * FROM cron.job:
-- - "\r\n" no campo command: ficheiro/cópia com fins de linha Windows (CRLF).
--   Grava o SQL com LF só (Unix) ou normaliza antes de colar no SQL Editor.
-- - Chave "sb_publishable_..." no Bearer: não é o JWT service_role; várias
--   Edge Functions precisam do JWT correto.
-- - "[SERVICE_ROLE_KEY]" literal: placeholder não substituído.
--
-- Este ficheiro NÃO coloca segredos em texto: usa só current_setting acima.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Remover jobs com estes nomes para poder reexecutar o script sem duplicar
DO $$
DECLARE
  j text;
  names text[] := ARRAY[
    'sync-daily-metrics',
    'process-whatsapp-workflows',
    'process-broadcast-queue',
    'process-scheduled-messages',
    'process-status-schedule',
    'sync-google-calendar-events',
    'process-google-business-posts',
    'process-scheduled-campaigns',
    'process-broadcast-queue-2'
  ];
BEGIN
  FOREACH j IN ARRAY names LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
      RAISE NOTICE 'Removido cron job: %', j;
    END IF;
  END LOOP;
END $$;

-- 1. Métricas diárias (meia-noite)
SELECT cron.schedule(
  'sync-daily-metrics',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/sync-daily-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2. Workflows WhatsApp (5 em 5 min)
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-whatsapp-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. Fila broadcast (disparador clássico)
SELECT cron.schedule(
  'process-broadcast-queue',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. Mensagens agendadas
SELECT cron.schedule(
  'process-scheduled-messages',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. Agendamento de status WhatsApp (stories)
SELECT cron.schedule(
  'process-status-schedule',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-status-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 6. Google Calendar
SELECT cron.schedule(
  'sync-google-calendar-events',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/sync-google-calendar-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 7. Google Business posts
SELECT cron.schedule(
  'process-google-business-posts',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-google-business-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 8. Campanhas agendadas (início automático)
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 9. Disparador 2 (fila alternativa)
SELECT cron.schedule(
  'process-broadcast-queue-2',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue-2',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Listagem final
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobid;

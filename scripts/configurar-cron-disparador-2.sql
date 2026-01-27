-- ============================================
-- Configurar Cron Job para Disparador 2
-- ============================================
-- Processa fila de broadcast do Disparador 2 a cada minuto
-- ============================================

-- Remover cron job existente se houver
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-broadcast-queue-2'
  ) THEN
    PERFORM cron.unschedule('process-broadcast-queue-2');
    RAISE NOTICE 'Cron job process-broadcast-queue-2 removido (será recriado)';
  END IF;
END $$;

-- Criar novo cron job
SELECT cron.schedule(
  'process-broadcast-queue-2',
  '*/1 * * * *', -- A cada minuto
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

-- Verificar se foi criado
SELECT 
  jobname,
  schedule,
  substring(command, 1, 100) as command_preview
FROM cron.job
WHERE jobname = 'process-broadcast-queue-2';

-- ============================================
-- CORRIGIR CRON JOB: Com chave obtida automaticamente
-- ============================================
-- Este script foi gerado automaticamente
-- Chave obtida via Supabase CLI
-- ============================================

-- Remover cron job antigo (se existir)
SELECT cron.unschedule('process-broadcast-queue');

-- Criar novo cron job com chave correta
SELECT cron.schedule(
  'process-broadcast-queue',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 2e723fdacb9da5cbf2df45d26761d2453e639bee91fde346b9a0f7ff67a6cebc'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verificar se foi criado corretamente
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    WHEN command LIKE '%Bearer%' AND LENGTH(command) > 200 THEN '✅ Comando parece correto'
    WHEN command LIKE '%[SERVICE_ROLE_KEY]%' THEN '❌ Placeholder ainda não substituído'
    WHEN command LIKE '%sb_publishable%' THEN '❌ Usando chave PUBLISHABLE (errado)'
    ELSE '⚠️ Verificar manualmente'
  END as status_chave,
  LEFT(command, 150) as comando_preview
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';



-- ============================================
-- CORRIGIR CRON JOB: PRONTO PARA EXECUTAR
-- ============================================
-- Este script foi gerado automaticamente com a chave correta
-- Execute diretamente no Supabase SQL Editor
-- ============================================
-- Data: 2025-01-06
-- Chave obtida automaticamente via Supabase CLI
-- ============================================

-- PASSO 1: Remover cron job antigo (se existir)
SELECT cron.unschedule('process-broadcast-queue');

-- PASSO 2: Criar novo cron job com chave SERVICE_ROLE_KEY correta
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

-- PASSO 3: Verificar se foi criado corretamente
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
  LEFT(command, 200) as comando_preview
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';

-- ============================================
-- VERIFICAÇÃO ADICIONAL: Últimas execuções
-- ============================================
SELECT 
  runid,
  start_time,
  status,
  return_message,
  CASE 
    WHEN status = 'succeeded' THEN '✅ Sucesso'
    WHEN status = 'failed' THEN '❌ Falhou'
    ELSE '⚠️ ' || status
  END as resultado
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-broadcast-queue'
ORDER BY start_time DESC
LIMIT 5;



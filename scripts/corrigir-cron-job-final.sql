-- ============================================
-- CORRIGIR CRON JOB: Versão Final (Sem Erros)
-- ============================================
-- Este script remove o cron job antigo e cria um novo
-- com a chave SERVICE_ROLE_KEY correta
-- ============================================

-- ⚠️ IMPORTANTE: Substitua [SERVICE_ROLE_KEY] pela chave real!
-- Onde encontrar: Supabase Dashboard > Settings > API > service_role key (secret)

-- ============================================
-- PASSO 1: Remover cron job antigo (se existir)
-- ============================================
SELECT cron.unschedule('process-broadcast-queue');

-- ============================================
-- PASSO 2: Criar novo cron job com chave correta
-- ============================================
-- ⚠️ SUBSTITUA [SERVICE_ROLE_KEY] PELA CHAVE REAL ANTES DE EXECUTAR!
-- Exemplo: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

SELECT cron.schedule(
  'process-broadcast-queue',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================
-- PASSO 3: Verificar se foi criado corretamente
-- ============================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN command LIKE '%[SERVICE_ROLE_KEY]%' THEN '❌ Placeholder ainda não substituído - SUBSTITUA pela chave real!'
    WHEN command LIKE '%sb_publishable%' THEN '❌ Usando chave PUBLISHABLE (errado)'
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    WHEN command LIKE '%Bearer%' AND LENGTH(command) > 200 THEN '✅ Comando parece correto'
    ELSE '⚠️ Verificar manualmente'
  END as status_chave,
  LEFT(command, 200) as comando_preview
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';


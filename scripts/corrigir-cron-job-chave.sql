-- ============================================
-- CORRIGIR CRON JOB: Trocar chave PUBLISHABLE por SERVICE_ROLE_KEY
-- ============================================
-- PROBLEMA: Cron job está usando chave PUBLISHABLE
-- SOLUÇÃO: Trocar por SERVICE_ROLE_KEY (que tem permissão)
-- ============================================

-- IMPORTANTE: Substituir [SERVICE_ROLE_KEY] pela chave real do Supabase
-- A chave SERVICE_ROLE_KEY pode ser encontrada em:
-- Supabase Dashboard > Settings > API > service_role key (secret)

-- 1. REMOVER CRON JOB ANTIGO (se existir)
-- ============================================
SELECT cron.unschedule('process-broadcast-queue');

-- 2. CRIAR NOVO CRON JOB COM CHAVE CORRETA
-- ============================================
SELECT cron.schedule(
  'process-broadcast-queue',
  '*/1 * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'  -- ⚠️ SUBSTITUIR PELA CHAVE REAL
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3. VERIFICAR SE FOI CRIADO CORRETAMENTE
-- ============================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN command LIKE '%sb_publishable%' THEN '❌ Ainda usando chave PUBLISHABLE'
    WHEN command LIKE '%Bearer [SERVICE_ROLE_KEY]%' THEN '⚠️ Placeholder não substituído'
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    ELSE '⚠️ Verificar manualmente'
  END as status_chave
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';

-- ============================================
-- INSTRUÇÕES:
-- ============================================
-- 1. Execute este script no Supabase SQL Editor
-- 2. ANTES de executar, substitua [SERVICE_ROLE_KEY] pela chave real
-- 3. A chave SERVICE_ROLE_KEY está em: Supabase Dashboard > Settings > API
-- 4. Após executar, verifique se o cron job foi criado corretamente
-- 5. Teste manualmente chamando a edge function para validar
-- ============================================


-- ============================================
-- ATUALIZAR CRON JOB: Substituir placeholder pela chave real
-- ============================================
-- PROBLEMA: Cron job tem placeholder [SERVICE_ROLE_KEY] não substituído
-- SOLUÇÃO: Atualizar comando do cron job existente
-- ============================================

-- ⚠️ IMPORTANTE: ANTES DE EXECUTAR, SUBSTITUA [SERVICE_ROLE_KEY] PELA CHAVE REAL!
-- 
-- Onde encontrar a SERVICE_ROLE_KEY:
-- 1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/api
-- 2. Role: service_role
-- 3. Copie a chave "secret" (não a anon key!)
-- 4. Substitua [SERVICE_ROLE_KEY] abaixo pela chave copiada

-- ============================================
-- MÉTODO 1: Atualizar comando do cron job existente
-- ============================================
-- Mais seguro - mantém o mesmo jobid

DO $$
DECLARE
  v_jobid INTEGER;
  v_new_command TEXT;
  v_service_role_key TEXT := '[SERVICE_ROLE_KEY]'; -- ⚠️ SUBSTITUIR AQUI!
BEGIN
  -- Buscar jobid do cron job
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'process-broadcast-queue';
  
  IF v_jobid IS NULL THEN
    RAISE EXCEPTION 'Cron job process-broadcast-queue não encontrado!';
  END IF;
  
  -- Verificar se placeholder ainda está lá
  IF v_service_role_key = '[SERVICE_ROLE_KEY]' THEN
    RAISE EXCEPTION 'ERRO: Você precisa substituir [SERVICE_ROLE_KEY] pela chave real antes de executar!';
  END IF;
  
  -- Construir novo comando com chave real
  v_new_command := format(
    $cmd$
    SELECT net.http_post(
      url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer %s'
      ),
      body := '{}'::jsonb
    );
    $cmd$,
    v_service_role_key
  );
  
  -- Atualizar comando do cron job
  UPDATE cron.job
  SET command = v_new_command::text
  WHERE jobid = v_jobid;
  
  RAISE NOTICE '✅ Cron job atualizado com sucesso! JobID: %', v_jobid;
END $$;

-- ============================================
-- VERIFICAR SE FOI ATUALIZADO CORRETAMENTE
-- ============================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN command LIKE '%[SERVICE_ROLE_KEY]%' THEN '❌ Placeholder ainda não substituído'
    WHEN command LIKE '%sb_publishable%' THEN '❌ Usando chave PUBLISHABLE (errado)'
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    WHEN command LIKE '%Bearer%' AND LENGTH(command) > 200 THEN '✅ Comando parece correto'
    ELSE '⚠️ Verificar manualmente'
  END as status_chave,
  LEFT(command, 150) as comando_preview
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';

-- ============================================
-- MÉTODO ALTERNATIVO: Remover e recriar
-- ============================================
-- Use este método se o método 1 não funcionar
-- 
-- Para usar este método, descomente as linhas abaixo e substitua [SERVICE_ROLE_KEY]
-- pela chave real antes de executar
--
-- 1. Remover cron job antigo:
-- SELECT cron.unschedule('process-broadcast-queue');
--
-- 2. Criar novo com chave real (SUBSTITUIR [SERVICE_ROLE_KEY]):
-- SELECT cron.schedule(
--   'process-broadcast-queue',
--   '*/1 * * * *',
--   'SELECT net.http_post(
--     url := ''https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue'',
--     headers := jsonb_build_object(
--       ''Content-Type'', ''application/json'',
--       ''Authorization'', ''Bearer [SERVICE_ROLE_KEY]''
--     ),
--     body := ''{}''::jsonb
--   );'
-- );


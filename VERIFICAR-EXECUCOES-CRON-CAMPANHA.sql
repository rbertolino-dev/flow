-- ============================================
-- Verificar Execuções do Cron Job
-- ============================================
-- Verificar se o cron job está executando e processando campanhas
-- ============================================

-- 1. Verificar últimas execuções do cron job (jobid 18)
SELECT 
  'Execuções do Cron' as tipo,
  start_time,
  end_time,
  status,
  CASE 
    WHEN status = 'succeeded' THEN '✅ Sucesso'
    WHEN status = 'failed' THEN '❌ Falhou'
    ELSE '⚠️ ' || status
  END as resultado,
  LEFT(return_message, 300) as mensagem,
  EXTRACT(EPOCH FROM (end_time - start_time)) as segundos_execucao
FROM cron.job_run_details 
WHERE jobid = 18
  AND start_time > '2026-01-22 19:40:00'  -- Depois do horário agendado
ORDER BY start_time DESC 
LIMIT 20;

-- 2. Verificar se cron job está ativo
SELECT 
  'Status do Cron Job' as tipo,
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active = false THEN '❌ INATIVO!'
    WHEN schedule != '*/1 * * * *' THEN '⚠️ Schedule incorreto'
    ELSE '✅ Configurado corretamente'
  END as status
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';

-- 3. Verificar campanha específica (deve ter iniciado)
SELECT 
  'Status da Campanha' as tipo,
  id,
  name,
  status,
  scheduled_start_at,
  started_at,
  NOW() as agora,
  EXTRACT(EPOCH FROM (NOW() - scheduled_start_at)) / 60 as minutos_atrasados,
  CASE 
    WHEN scheduled_start_at <= NOW() AND status = 'draft' THEN '⚠️ DEVERIA TER INICIADO!'
    WHEN status = 'running' THEN '✅ Já iniciou'
    ELSE '❓ Status: ' || status
  END as diagnostico
FROM broadcast_campaigns
WHERE id = 'de3e4282-d7ff-48ed-ab9c-5f9210f5be80';

-- 4. Testar função manualmente (chamar agora)
-- Descomente as linhas abaixo para testar:
/*
SELECT net.http_post(
  url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
  ),
  body := '{}'::jsonb
) as resultado_teste;
*/

-- ============================================
-- INTERPRETAÇÃO:
-- ============================================
-- Se verificação 1 não mostrar execuções após 19:40:00:
--   → Cron job não está executando
--   → Verificar se está ativo (verificação 2)
--
-- Se verificação 1 mostrar execuções mas status 'failed':
--   → Função tem erro
--   → Verificar logs da edge function no Dashboard
--
-- Se verificação 1 mostrar execuções com status 'succeeded':
--   → Função está executando mas não está processando a campanha
--   → Verificar se query da função está correta
--   → Verificar logs da função para ver se encontrou a campanha
--
-- Se verificação 3 mostrar status ainda 'draft':
--   → Campanha não foi processada
--   → Testar função manualmente (verificação 4)
-- ============================================

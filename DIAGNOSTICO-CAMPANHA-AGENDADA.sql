-- ============================================
-- DIAGNÓSTICO COMPLETO: Campanha Agendada Não Dispara
-- ============================================
-- Execute este script no Supabase SQL Editor
-- para diagnosticar por que a campanha não disparou
-- ============================================

-- 1. Verificar se coluna scheduled_start_at existe
SELECT 
  '1. Coluna scheduled_start_at' as verificacao,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'broadcast_campaigns'
        AND column_name = 'scheduled_start_at'
    ) THEN '✅ Existe'
    ELSE '❌ NÃO EXISTE - Execute DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql'
  END as status;

-- 2. Verificar se cron job existe e está ativo
SELECT 
  '2. Cron Job' as verificacao,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM cron.job 
      WHERE jobname = 'process-scheduled-campaigns' 
        AND active = true
    ) THEN '✅ Existe e está ATIVO'
    WHEN EXISTS (
      SELECT 1 FROM cron.job 
      WHERE jobname = 'process-scheduled-campaigns' 
        AND active = false
    ) THEN '⚠️ Existe mas está INATIVO'
    ELSE '❌ NÃO EXISTE - Execute DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql'
  END as status;

-- 3. Verificar extensões necessárias
SELECT 
  '3. Extensões' as verificacao,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
      AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http')
    THEN '✅ pg_cron e http habilitadas'
    ELSE '❌ Extensões faltando'
  END as status;

-- 4. Verificar campanhas agendadas (que ainda não iniciaram)
SELECT 
  '4. Campanhas Agendadas' as verificacao,
  COUNT(*) as total,
  STRING_AGG(name, ', ') as nomes
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
  AND status = 'draft'
  AND scheduled_start_at > NOW();

-- 5. Verificar campanhas que DEVERIAM ter iniciado (mas não iniciaram)
SELECT 
  '5. Campanhas que Deveriam Ter Iniciado' as verificacao,
  id,
  name,
  status,
  scheduled_start_at,
  NOW() as agora,
  EXTRACT(EPOCH FROM (NOW() - scheduled_start_at)) / 60 as minutos_atrasados
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
  AND status = 'draft'
  AND scheduled_start_at <= NOW()
ORDER BY scheduled_start_at DESC
LIMIT 5;

-- 6. Verificar últimas execuções do cron job
SELECT 
  '6. Últimas Execuções do Cron' as verificacao,
  start_time,
  end_time,
  status,
  LEFT(return_message, 100) as mensagem_resumo
FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-campaigns'
)
ORDER BY start_time DESC 
LIMIT 5;

-- 7. Verificar se há itens na fila para campanhas agendadas
SELECT 
  '7. Itens na Fila' as verificacao,
  COUNT(*) as total_pendentes,
  COUNT(DISTINCT campaign_id) as campanhas_com_fila
FROM broadcast_queue bq
INNER JOIN broadcast_campaigns bc ON bc.id = bq.campaign_id
WHERE bc.scheduled_start_at IS NOT NULL
  AND bc.status = 'draft'
  AND bq.status = 'pending';

-- 8. Verificar detalhes do cron job
SELECT 
  '8. Detalhes do Cron Job' as verificacao,
  jobid,
  jobname,
  schedule,
  active,
  LEFT(command::text, 200) as comando_resumo
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';

-- ============================================
-- RESUMO E PRÓXIMOS PASSOS
-- ============================================
-- Se "Campanhas que Deveriam Ter Iniciado" retornar linhas:
--   → A campanha está agendada mas não iniciou
--   → Verifique se cron job está ativo (verificação 2)
--   → Verifique se há execuções recentes (verificação 6)
--
-- Se "Últimas Execuções" estiver vazio:
--   → Cron job não está executando
--   → Verifique se está ativo (verificação 2)
--   → Verifique se extensões estão habilitadas (verificação 3)
--
-- Se "Campanhas Agendadas" retornar 0:
--   → Nenhuma campanha está agendada
--   → Verifique se frontend salvou scheduled_start_at
-- ============================================

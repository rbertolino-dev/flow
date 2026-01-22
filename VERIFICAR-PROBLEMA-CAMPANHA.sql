-- ============================================
-- Verificar Problema Específico da Campanha
-- ============================================
-- Execute este script para identificar o problema exato
-- ============================================

-- 1. Verificar se há campanhas que DEVERIAM ter iniciado
SELECT 
  '⚠️ PROBLEMA: Campanhas que deveriam ter iniciado' as tipo,
  id,
  name,
  status,
  scheduled_start_at,
  NOW() as agora,
  ROUND(EXTRACT(EPOCH FROM (NOW() - scheduled_start_at)) / 60, 2) as minutos_atrasados
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
  AND status = 'draft'
  AND scheduled_start_at <= NOW()
ORDER BY scheduled_start_at DESC;

-- 2. Verificar se frontend salvou scheduled_start_at
SELECT 
  'Verificar Frontend' as tipo,
  id,
  name,
  status,
  scheduled_start_at,
  CASE 
    WHEN scheduled_start_at IS NULL THEN '❌ Frontend NÃO salvou - Precisa fazer deploy!'
    WHEN scheduled_start_at IS NOT NULL THEN '✅ Frontend salvou corretamente'
  END as diagnostico
FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar se campanha tem itens na fila (CRÍTICO!)
SELECT 
  'Verificar Fila' as tipo,
  bc.id,
  bc.name,
  bc.status,
  COUNT(bq.id) as total_itens,
  COUNT(CASE WHEN bq.status = 'pending' THEN 1 END) as pendentes,
  COUNT(CASE WHEN bq.status = 'scheduled' THEN 1 END) as agendados,
  CASE 
    WHEN COUNT(bq.id) = 0 THEN '❌ PROBLEMA: Campanha NÃO tem itens na fila!'
    WHEN COUNT(CASE WHEN bq.status = 'pending' THEN 1 END) = 0 THEN '⚠️ Nenhum item pendente'
    ELSE '✅ Tem itens na fila'
  END as diagnostico
FROM broadcast_campaigns bc
LEFT JOIN broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.created_at > NOW() - INTERVAL '24 hours'
  AND bc.scheduled_start_at IS NOT NULL
GROUP BY bc.id, bc.name, bc.status
ORDER BY bc.created_at DESC
LIMIT 5;

-- 4. Verificar últimas execuções do cron (jobid 18)
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
  LEFT(return_message, 150) as mensagem
FROM cron.job_run_details 
WHERE jobid = 18
ORDER BY start_time DESC 
LIMIT 10;

-- 5. Verificar se há campanhas agendadas para o futuro (está funcionando)
SELECT 
  'Campanhas Agendadas (Futuro)' as tipo,
  COUNT(*) as total,
  STRING_AGG(name, ', ') as nomes
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
  AND status = 'draft'
  AND scheduled_start_at > NOW();

-- ============================================
-- INTERPRETAÇÃO DOS RESULTADOS
-- ============================================
-- 
-- Se verificação 1 retornar linhas:
--   → Campanha está agendada mas não iniciou
--   → Verificar se cron está executando (verificação 4)
--   → Verificar se campanha tem itens na fila (verificação 3)
--
-- Se verificação 2 mostrar "Frontend NÃO salvou":
--   → Fazer deploy do frontend: ./scripts/deploy-zero-downtime.sh
--
-- Se verificação 3 mostrar "NÃO tem itens na fila":
--   → Campanha foi criada sem contatos
--   → Verificar se ao criar campanha, contatos foram adicionados
--
-- Se verificação 4 não mostrar execuções recentes:
--   → Cron job não está executando
--   → Verificar logs da edge function
--
-- ============================================

-- ============================================
-- Verificar Campanha Específica que Não Disparou
-- ============================================
-- Execute este script para verificar uma campanha específica
-- ============================================

-- 1. Verificar campanhas criadas recentemente
SELECT 
  id,
  name,
  status,
  scheduled_start_at,
  started_at,
  created_at,
  CASE 
    WHEN scheduled_start_at IS NULL THEN '❌ Frontend NÃO salvou scheduled_start_at'
    WHEN scheduled_start_at > NOW() THEN '✅ Agendada para futuro'
    WHEN scheduled_start_at <= NOW() AND status = 'draft' THEN '⚠️ DEVERIA TER INICIADO - Cron não processou!'
    WHEN status = 'running' THEN '✅ Já iniciou'
    ELSE '❓ Status desconhecido'
  END as diagnostico,
  EXTRACT(EPOCH FROM (NOW() - scheduled_start_at)) / 60 as minutos_atrasados
FROM broadcast_campaigns
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Verificar se campanha tem itens na fila
SELECT 
  bc.id as campaign_id,
  bc.name as campaign_name,
  bc.status as campaign_status,
  bc.scheduled_start_at,
  COUNT(bq.id) as total_itens_fila,
  COUNT(CASE WHEN bq.status = 'pending' THEN 1 END) as itens_pendentes,
  COUNT(CASE WHEN bq.status = 'scheduled' THEN 1 END) as itens_agendados
FROM broadcast_campaigns bc
LEFT JOIN broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.created_at > NOW() - INTERVAL '24 hours'
GROUP BY bc.id, bc.name, bc.status, bc.scheduled_start_at
ORDER BY bc.created_at DESC
LIMIT 10;

-- 3. Verificar últimas execuções do cron (últimas 10)
SELECT 
  start_time,
  end_time,
  status,
  LEFT(return_message, 200) as mensagem
FROM cron.job_run_details 
WHERE jobid = 18  -- jobid do process-scheduled-campaigns
ORDER BY start_time DESC 
LIMIT 10;

-- 4. Verificar se há campanhas que deveriam ter iniciado
SELECT 
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

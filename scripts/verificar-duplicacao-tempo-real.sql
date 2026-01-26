-- ============================================================================
-- VERIFICAÇÃO EM TEMPO REAL: Duplicação para 21966224051 - PubDigital
-- ============================================================================
-- Execute estas queries para ver o que está acontecendo AGORA
-- ============================================================================

-- QUERY 1: Ver TODAS as mensagens desta campanha para este telefone (TEMPO REAL)
SELECT 
  bq.id,
  bq.campaign_id,
  bc.name as campaign_name,
  bc.sending_method,
  bc.status as campaign_status,
  bq.phone,
  bq.instance_id,
  bq.status,
  bq.created_at,
  bq.scheduled_for,
  bq.sent_at,
  bq.sending_started_at,
  bq.processing_lock_until,
  bq.error_message,
  EXTRACT(EPOCH FROM (NOW() - bq.created_at)) / 60 as minutos_desde_criacao,
  CASE 
    WHEN bq.status = 'pending' THEN 'AGUARDANDO AGENDAMENTO'
    WHEN bq.status = 'scheduled' AND bq.scheduled_for <= NOW() THEN 'PRONTA PARA ENVIAR'
    WHEN bq.status = 'scheduled' AND bq.scheduled_for > NOW() THEN 'AGENDADA'
    WHEN bq.status = 'sending' THEN 'SENDO ENVIADA AGORA'
    WHEN bq.status = 'sent' THEN 'JÁ ENVIADA'
    WHEN bq.status = 'failed' THEN 'FALHOU'
    WHEN bq.status = 'cancelled' THEN 'CANCELADA'
    ELSE 'OUTRO'
  END as situacao_atual
FROM broadcast_queue bq
LEFT JOIN broadcast_campaigns bc ON bc.id = bq.campaign_id
LEFT JOIN organizations o ON o.id = bc.organization_id
WHERE o.name ILIKE '%pubdigital%'
  AND bq.phone LIKE '%21966224051%'
ORDER BY bq.created_at DESC, bq.scheduled_for DESC;

-- QUERY 2: Contar quantas mensagens foram criadas/enviadas (TEMPO REAL)
SELECT 
  bq.campaign_id,
  bc.name as campaign_name,
  bc.sending_method,
  bc.status as campaign_status,
  bc.started_at,
  bq.phone,
  bq.instance_id,
  COUNT(*) as total_mensagens,
  COUNT(CASE WHEN bq.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN bq.status = 'scheduled' THEN 1 END) as scheduled,
  COUNT(CASE WHEN bq.status = 'sending' THEN 1 END) as sending,
  COUNT(CASE WHEN bq.status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN bq.status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN bq.status = 'cancelled' THEN 1 END) as cancelled,
  MIN(bq.created_at) as primeira_criacao,
  MAX(bq.created_at) as ultima_criacao,
  MIN(bq.scheduled_for) as primeiro_agendamento,
  MAX(bq.scheduled_for) as ultimo_agendamento,
  MIN(bq.sent_at) as primeiro_envio,
  MAX(bq.sent_at) as ultimo_envio,
  COUNT(DISTINCT bq.sent_at) as envios_unicos,
  EXTRACT(EPOCH FROM (MAX(bq.created_at) - MIN(bq.created_at))) / 60 as minutos_entre_criacoes
FROM broadcast_queue bq
LEFT JOIN broadcast_campaigns bc ON bc.id = bq.campaign_id
LEFT JOIN organizations o ON o.id = bc.organization_id
WHERE o.name ILIKE '%pubdigital%'
  AND bq.phone LIKE '%21966224051%'
GROUP BY bq.campaign_id, bc.name, bc.sending_method, bc.status, bc.started_at, bq.phone, bq.instance_id
ORDER BY total_mensagens DESC, ultima_criacao DESC;

-- QUERY 3: Ver mensagens que estão sendo processadas AGORA (TEMPO REAL)
SELECT 
  bq.id,
  bq.campaign_id,
  bc.name as campaign_name,
  bq.phone,
  bq.instance_id,
  bq.status,
  bq.created_at,
  bq.scheduled_for,
  bq.sent_at,
  bq.sending_started_at,
  bq.processing_lock_until,
  CASE 
    WHEN bq.processing_lock_until IS NOT NULL AND bq.processing_lock_until > NOW() THEN 'LOCKADO'
    WHEN bq.status = 'sending' THEN 'SENDO ENVIADA'
    WHEN bq.status = 'scheduled' AND bq.scheduled_for <= NOW() THEN 'PRONTA PARA PROCESSAR'
    ELSE 'OUTRO'
  END as estado_processamento,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(bq.sending_started_at, bq.created_at))) / 60 as minutos_em_processamento
FROM broadcast_queue bq
LEFT JOIN broadcast_campaigns bc ON bc.id = bq.campaign_id
LEFT JOIN organizations o ON o.id = bc.organization_id
WHERE o.name ILIKE '%pubdigital%'
  AND bq.phone LIKE '%21966224051%'
  AND bq.status IN ('pending', 'scheduled', 'sending')
ORDER BY bq.scheduled_for ASC, bq.created_at ASC;

-- QUERY 4: Verificar se há mensagens duplicadas sendo criadas AGORA (TEMPO REAL)
SELECT 
  bq.phone,
  bq.campaign_id,
  bc.name as campaign_name,
  bq.instance_id,
  bq.status,
  COUNT(*) as total,
  STRING_AGG(bq.id::text, ', ' ORDER BY bq.created_at) as ids,
  MIN(bq.created_at) as primeira,
  MAX(bq.created_at) as ultima,
  EXTRACT(EPOCH FROM (MAX(bq.created_at) - MIN(bq.created_at))) as segundos_entre_criacoes
FROM broadcast_queue bq
LEFT JOIN broadcast_campaigns bc ON bc.id = bq.campaign_id
LEFT JOIN organizations o ON o.id = bc.organization_id
WHERE o.name ILIKE '%pubdigital%'
  AND bq.phone LIKE '%21966224051%'
  AND bq.status IN ('pending', 'scheduled', 'sending')
GROUP BY bq.phone, bq.campaign_id, bc.name, bq.instance_id, bq.status
HAVING COUNT(*) > 1
ORDER BY total DESC, ultima DESC;

-- QUERY 5: Verificar campanha atual e seu status (TEMPO REAL)
SELECT 
  bc.id,
  bc.name,
  bc.sending_method,
  bc.status,
  bc.started_at,
  bc.min_delay_seconds,
  bc.max_delay_seconds,
  o.name as organization_name,
  COUNT(bq.id) as total_mensagens_fila,
  COUNT(CASE WHEN bq.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN bq.status = 'scheduled' THEN 1 END) as scheduled,
  COUNT(CASE WHEN bq.status = 'sending' THEN 1 END) as sending,
  COUNT(CASE WHEN bq.status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN bq.status = 'failed' THEN 1 END) as failed,
  COUNT(DISTINCT bq.phone) as telefones_unicos,
  COUNT(bq.id) - COUNT(DISTINCT bq.phone) as possiveis_duplicatas
FROM broadcast_campaigns bc
LEFT JOIN organizations o ON o.id = bc.organization_id
LEFT JOIN broadcast_queue bq ON bq.campaign_id = bc.id
WHERE o.name ILIKE '%pubdigital%'
  AND bc.status IN ('running', 'draft')
  AND EXISTS (
    SELECT 1 FROM broadcast_queue bq2 
    WHERE bq2.campaign_id = bc.id 
    AND bq2.phone LIKE '%21966224051%'
  )
GROUP BY bc.id, bc.name, bc.sending_method, bc.status, bc.started_at, bc.min_delay_seconds, bc.max_delay_seconds, o.name
ORDER BY bc.started_at DESC NULLS LAST, bc.created_at DESC
LIMIT 5;

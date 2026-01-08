-- ==========================================
-- CORREÇÃO: Campanhas canceladas bloqueando disparos
-- ==========================================
-- Execute no Supabase SQL Editor
-- ==========================================

-- 1. IDENTIFICAR CAMPANHAS CANCELADAS COM MENSAGENS AGENDADAS
SELECT 
  '🚨 Campanhas canceladas com mensagens agendadas' as tipo,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_campanha,
  bc.created_at as criada_em,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled') as mensagens_agendadas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for <= NOW()) as mensagens_atrasadas,
  MIN(bq.scheduled_for) FILTER (WHERE bq.status = 'scheduled') as primeira_mensagem_agendada,
  MAX(bq.scheduled_for) FILTER (WHERE bq.status = 'scheduled') as ultima_mensagem_agendada
FROM public.broadcast_campaigns bc
LEFT JOIN public.broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bc.status = 'cancelled'
GROUP BY bc.id, bc.name, bc.status, bc.created_at
HAVING COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled') > 0
ORDER BY bc.created_at DESC;

-- 2. VER TODAS AS CAMPANHAS E SEUS STATUS
SELECT 
  '📊 Todas as campanhas da organização' as tipo,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_campanha,
  bc.created_at as criada_em,
  bc.started_at as iniciada_em,
  bc.completed_at as concluida_em,
  bc.sent_count as enviadas,
  bc.failed_count as falhas,
  bc.total_contacts as total,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled') as mensagens_agendadas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'sent') as mensagens_enviadas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'failed') as mensagens_falhadas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'pending') as mensagens_pendentes
FROM public.broadcast_campaigns bc
LEFT JOIN public.broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
GROUP BY bc.id, bc.name, bc.status, bc.created_at, bc.started_at, bc.completed_at, bc.sent_count, bc.failed_count, bc.total_contacts
ORDER BY bc.created_at DESC;

-- 3. MENSAGENS AGENDADAS DE CAMPANHAS CANCELADAS (DETALHADO)
SELECT 
  '📋 Mensagens agendadas de campanhas canceladas' as tipo,
  bq.id as queue_id,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_campanha,
  bq.status as status_fila,
  bq.scheduled_for as agendado_para,
  NOW() as agora,
  EXTRACT(EPOCH FROM (NOW() - bq.scheduled_for)) / 60 as minutos_atrasado,
  bq.phone as telefone,
  bq.name as nome_contato
FROM public.broadcast_queue bq
JOIN public.broadcast_campaigns bc ON bc.id = bq.campaign_id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bc.status = 'cancelled'
AND bq.status = 'scheduled'
ORDER BY bq.scheduled_for ASC;

-- ==========================================
-- OPÇÕES DE CORREÇÃO
-- ==========================================

-- OPÇÃO 1: REATIVAR CAMPANHAS CANCELADAS (se quiser continuar os disparos)
-- Descomente e execute APENAS se quiser reativar as campanhas:
/*
UPDATE public.broadcast_campaigns
SET status = 'running',
    started_at = COALESCE(started_at, NOW())
WHERE id IN (
  SELECT bc.id
  FROM public.broadcast_campaigns bc
  WHERE bc.organization_id IN (
    SELECT id FROM public.organizations 
    WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
  )
  AND bc.status = 'cancelled'
  AND EXISTS (
    SELECT 1 FROM public.broadcast_queue bq
    WHERE bq.campaign_id = bc.id
    AND bq.status = 'scheduled'
  )
);
*/

-- OPÇÃO 2: CANCELAR MENSAGENS AGENDADAS DE CAMPANHAS CANCELADAS (limpar fila)
-- Descomente e execute APENAS se quiser cancelar as mensagens pendentes:
/*
UPDATE public.broadcast_queue
SET status = 'cancelled',
    error_message = 'Campanha foi cancelada'
WHERE campaign_id IN (
  SELECT bc.id
  FROM public.broadcast_campaigns bc
  WHERE bc.organization_id IN (
    SELECT id FROM public.organizations 
    WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
  )
  AND bc.status = 'cancelled'
)
AND status = 'scheduled';
*/

-- ==========================================
-- VERIFICAR CAMPANHAS RODANDO MAS SEM DISPAROS
-- ==========================================
SELECT 
  '⚠️ Campanhas rodando mas sem envios' as tipo,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_campanha,
  bc.created_at as criada_em,
  bc.started_at as iniciada_em,
  bc.sent_count as enviadas,
  bc.failed_count as falhas,
  bc.total_contacts as total,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for <= NOW()) as mensagens_atrasadas_nao_disparadas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for > NOW()) as mensagens_agendadas_futuro,
  COUNT(bq.id) FILTER (WHERE bq.status = 'sent') as mensagens_enviadas,
  COUNT(bq.id) FILTER (WHERE bq.instance_id IS NULL) as mensagens_sem_instancia
FROM public.broadcast_campaigns bc
LEFT JOIN public.broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bc.status = 'running'
GROUP BY bc.id, bc.name, bc.status, bc.created_at, bc.started_at, bc.sent_count, bc.failed_count, bc.total_contacts
HAVING COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for <= NOW()) > 0
   OR COUNT(bq.id) FILTER (WHERE bq.instance_id IS NULL) > 0
ORDER BY bc.created_at DESC;


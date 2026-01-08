-- ==========================================
-- REATIVAR CAMPANHAS CANCELADAS - "iclass sistemas"
-- ==========================================
-- ATENÇÃO: Este script reativa campanhas canceladas que têm mensagens agendadas
-- Execute apenas se quiser continuar os disparos dessas campanhas
-- ==========================================

-- 1. Verificar quais campanhas serão reativadas (ANTES de executar)
SELECT 
  '🔍 Campanhas que serão reativadas' as tipo,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_atual,
  bc.created_at as criada_em,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled') as mensagens_agendadas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled' AND bq.scheduled_for <= NOW()) as mensagens_atrasadas
FROM public.broadcast_campaigns bc
LEFT JOIN public.broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bc.status = 'cancelled'
AND EXISTS (
  SELECT 1 FROM public.broadcast_queue bq2
  WHERE bq2.campaign_id = bc.id
  AND bq2.status = 'scheduled'
)
GROUP BY bc.id, bc.name, bc.status, bc.created_at;

-- 2. REATIVAR CAMPANHAS CANCELADAS COM MENSAGENS AGENDADAS
UPDATE public.broadcast_campaigns
SET 
  status = 'running',
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

-- 3. Verificar resultado
SELECT 
  '✅ Campanhas reativadas' as tipo,
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_atual,
  bc.started_at as iniciada_em,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled') as mensagens_agendadas
FROM public.broadcast_campaigns bc
LEFT JOIN public.broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bc.status = 'running'
AND bc.started_at >= NOW() - INTERVAL '1 minute'
GROUP BY bc.id, bc.name, bc.status, bc.started_at;


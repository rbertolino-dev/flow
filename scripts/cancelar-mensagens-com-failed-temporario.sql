-- ==========================================
-- CANCELAR MENSAGENS USANDO STATUS 'failed' (TEMPORÁRIO)
-- ==========================================
-- Use este script se a migration ainda não foi aplicada
-- Este script usa 'failed' ao invés de 'cancelled'
-- ==========================================

-- 1. Verificar quantas mensagens serão marcadas como 'failed' (ANTES de executar)
SELECT 
  '🔍 Mensagens que serão marcadas como failed' as tipo,
  COUNT(*) as total_mensagens,
  COUNT(DISTINCT bq.campaign_id) as total_campanhas,
  MIN(bq.scheduled_for) as primeira_mensagem,
  MAX(bq.scheduled_for) as ultima_mensagem
FROM public.broadcast_queue bq
JOIN public.broadcast_campaigns bc ON bc.id = bq.campaign_id
WHERE bc.organization_id IN (
  SELECT id FROM public.organizations 
  WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
)
AND bc.status = 'cancelled'
AND bq.status = 'scheduled';

-- 2. MARCAR MENSAGENS COMO 'failed' (status válido)
UPDATE public.broadcast_queue
SET 
  status = 'failed',
  error_message = 'Campanha foi cancelada - mensagens não serão enviadas'
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

-- 3. Verificar resultado
SELECT 
  '✅ Mensagens marcadas como failed' as tipo,
  COUNT(*) as total_failed,
  COUNT(DISTINCT campaign_id) as campanhas_afetadas
FROM public.broadcast_queue
WHERE status = 'failed'
AND error_message = 'Campanha foi cancelada - mensagens não serão enviadas'
AND campaign_id IN (
  SELECT bc.id
  FROM public.broadcast_campaigns bc
  WHERE bc.organization_id IN (
    SELECT id FROM public.organizations 
    WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
  )
);


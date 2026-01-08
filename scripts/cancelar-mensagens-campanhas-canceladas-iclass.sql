-- ==========================================
-- CANCELAR MENSAGENS DE CAMPANHAS CANCELADAS - "iclass sistemas"
-- ==========================================
-- ATENÇÃO: Este script cancela mensagens agendadas de campanhas canceladas
-- Execute apenas se quiser limpar a fila de campanhas canceladas
-- ==========================================

-- 1. Verificar quantas mensagens serão canceladas (ANTES de executar)
SELECT 
  '🔍 Mensagens que serão canceladas' as tipo,
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

-- IMPORTANTE: Execute primeiro a migration para adicionar status 'cancelled'
-- Migration: supabase/migrations/20260106000001_add_cancelled_status_to_broadcast_queue.sql

-- 2. CANCELAR MENSAGENS AGENDADAS DE CAMPANHAS CANCELADAS
-- Se a migration ainda não foi aplicada, use 'failed' ao invés de 'cancelled'
UPDATE public.broadcast_queue
SET 
  status = 'cancelled',  -- Se der erro, use 'failed' temporariamente
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
  '✅ Mensagens canceladas' as tipo,
  COUNT(*) as total_canceladas,
  COUNT(DISTINCT campaign_id) as campanhas_afetadas
FROM public.broadcast_queue
WHERE status = 'cancelled'
AND error_message = 'Campanha foi cancelada - mensagens não serão enviadas'
AND campaign_id IN (
  SELECT bc.id
  FROM public.broadcast_campaigns bc
  WHERE bc.organization_id IN (
    SELECT id FROM public.organizations 
    WHERE LOWER(name) LIKE '%iclass%' OR LOWER(name) LIKE '%sistemas%'
  )
);


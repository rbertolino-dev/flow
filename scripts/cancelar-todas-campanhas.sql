-- Script para cancelar TODAS as campanhas ativas
-- ATENÇÃO: Este script cancela TODAS as campanhas que não estão canceladas ou concluídas

BEGIN;

-- PASSO 1: Cancelar todas as campanhas que não estão canceladas ou concluídas
UPDATE broadcast_campaigns
SET 
  status = 'cancelled',
  completed_at = NOW()
WHERE 
  status NOT IN ('cancelled', 'completed', 'finished')
  AND completed_at IS NULL;

-- PASSO 2: Cancelar todos os itens da fila relacionados a campanhas canceladas
-- Primeiro, tentar usar status 'cancelled'
UPDATE broadcast_queue
SET 
  status = 'cancelled',
  error_message = 'Campanha cancelada via script SQL'
WHERE 
  campaign_id IN (
    SELECT id FROM broadcast_campaigns WHERE status = 'cancelled'
  )
  AND status IN ('pending', 'scheduled');

-- Se 'cancelled' não for permitido na constraint, usar 'failed' como fallback
-- (Execute este comando apenas se o anterior falhar)
-- UPDATE broadcast_queue
-- SET 
--   status = 'failed',
--   error_message = 'Campanha cancelada via script SQL'
-- WHERE 
--   campaign_id IN (
--     SELECT id FROM broadcast_campaigns WHERE status = 'cancelled'
--   )
--   AND status IN ('pending', 'scheduled');

-- Verificar resultado
SELECT 
  COUNT(*) as total_canceladas,
  status,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as com_data_conclusao
FROM broadcast_campaigns
WHERE status = 'cancelled'
GROUP BY status;

COMMIT;



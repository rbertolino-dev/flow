-- ============================================
-- Script: Aplicar Índice Único para Prevenir Duplicação
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Remover índice antigo se existir
DROP INDEX IF EXISTS unique_phone_campaign_active_idx;
DROP INDEX IF EXISTS unique_phone_campaign_instance_active_idx;

-- Criar índice único que impede novas duplicatas ativas
-- IMPORTANTE: Apenas para status ativos (pending, scheduled, sending)
-- Permite múltiplas entradas com status 'sent' ou 'failed' (histórico)
CREATE UNIQUE INDEX unique_phone_campaign_instance_active_idx
ON broadcast_queue (phone, campaign_id, instance_id)
WHERE status IN ('pending', 'scheduled', 'sending');

-- Comentário explicativo
COMMENT ON INDEX unique_phone_campaign_instance_active_idx IS 
  'Previne duplicação: uma mensagem por telefone+campanha+instância em status ativo (pending/scheduled/sending)';

-- Verificar se índice foi criado
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'broadcast_queue'
  AND indexname = 'unique_phone_campaign_instance_active_idx';

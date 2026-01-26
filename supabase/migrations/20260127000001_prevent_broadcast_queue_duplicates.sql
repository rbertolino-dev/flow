-- ============================================================================
-- Migration: Prevenir Duplicação na broadcast_queue
-- ============================================================================
-- Data: 2026-01-27
-- Descrição: Adiciona índice único parcial para prevenir duplicação de mensagens
--            na mesma campanha para o mesmo telefone (status pending/scheduled)
-- ============================================================================

-- Remover índice anterior se existir (para permitir re-aplicação)
DROP INDEX IF EXISTS unique_phone_campaign_pending_idx;

-- Criar índice único parcial para prevenir duplicação
-- Permite múltiplas instâncias (modo separate), mas previne duplicação por telefone+campanha
-- Apenas para status pending e scheduled (permite múltiplas tentativas após envio)
-- NOTA: Em PostgreSQL, constraints UNIQUE parciais não são suportadas diretamente,
-- então usamos um índice único parcial (UNIQUE INDEX) que tem o mesmo efeito
CREATE UNIQUE INDEX unique_phone_campaign_pending_idx 
ON broadcast_queue (phone, campaign_id, status) 
WHERE status IN ('pending', 'scheduled');

-- Comentário explicativo
COMMENT ON INDEX unique_phone_campaign_pending_idx IS 
'Previne duplicação de mensagens para o mesmo telefone na mesma campanha quando status é pending ou scheduled. Permite múltiplas instâncias (modo separate) mas garante que cada telefone só aparece uma vez por status.';

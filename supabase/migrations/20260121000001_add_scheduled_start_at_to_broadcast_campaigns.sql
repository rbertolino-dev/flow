-- ============================================
-- Adicionar Agendamento de Início de Campanha
-- ============================================
-- Adiciona suporte para agendar o início automático de campanhas
-- ============================================

-- 1. Adicionar coluna scheduled_start_at em broadcast_campaigns
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

-- 2. Criar índice para queries de campanhas agendadas
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_scheduled_start 
  ON public.broadcast_campaigns(scheduled_start_at) 
  WHERE scheduled_start_at IS NOT NULL AND status = 'draft';

-- 3. Comentário para documentação
COMMENT ON COLUMN public.broadcast_campaigns.scheduled_start_at IS 'Data e hora agendada para início automático da campanha. Quando chegar este horário, a campanha será iniciada automaticamente pelo processo de verificação.';

-- ============================================
-- Adicionar campos de repetição, combo e cancelamento em scheduled_messages
-- ============================================
-- Esta migration adiciona suporte para:
-- 1. Repetição de mensagens (diária, semanal, mensal)
-- 2. Mensagens em combo (segunda mensagem vinculada)
-- 3. Motivo de cancelamento
-- ============================================

-- Adicionar campos de repetição
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS repeat_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_period TEXT CHECK (repeat_period IN ('daily', 'weekly', 'monthly', 'yearly')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_scheduled_date DATE DEFAULT NULL; -- Data original para repetir sempre no mesmo dia

-- Adicionar campos de combo (mensagem vinculada)
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE CASCADE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_combo_message BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS combo_delay_days INTEGER DEFAULT NULL; -- Dias após a primeira mensagem

-- Adicionar campo de cancelamento com motivo
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_repeat_enabled 
  ON public.scheduled_messages(repeat_enabled) 
  WHERE repeat_enabled = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_parent_message 
  ON public.scheduled_messages(parent_message_id) 
  WHERE parent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_is_combo 
  ON public.scheduled_messages(is_combo_message) 
  WHERE is_combo_message = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_original_date 
  ON public.scheduled_messages(original_scheduled_date) 
  WHERE original_scheduled_date IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.scheduled_messages.repeat_enabled IS 'Se a mensagem deve ser repetida';
COMMENT ON COLUMN public.scheduled_messages.repeat_period IS 'Período de repetição: daily, weekly, monthly, yearly';
COMMENT ON COLUMN public.scheduled_messages.repeat_count IS 'Quantas vezes a mensagem será repetida';
COMMENT ON COLUMN public.scheduled_messages.repeat_until IS 'Data limite para repetição (opcional)';
COMMENT ON COLUMN public.scheduled_messages.original_scheduled_date IS 'Data original do agendamento (para repetir sempre no mesmo dia do mês)';
COMMENT ON COLUMN public.scheduled_messages.parent_message_id IS 'ID da mensagem pai (para mensagens em combo)';
COMMENT ON COLUMN public.scheduled_messages.is_combo_message IS 'Se esta é a segunda mensagem de um combo';
COMMENT ON COLUMN public.scheduled_messages.combo_delay_days IS 'Dias após a primeira mensagem para enviar a segunda';
COMMENT ON COLUMN public.scheduled_messages.cancel_reason IS 'Motivo do cancelamento da mensagem';
COMMENT ON COLUMN public.scheduled_messages.cancelled_at IS 'Data/hora do cancelamento';

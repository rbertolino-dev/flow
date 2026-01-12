-- Adicionar campo sending_started_at para detectar mensagens travadas
ALTER TABLE public.broadcast_queue
  ADD COLUMN IF NOT EXISTS sending_started_at TIMESTAMPTZ;

-- Criar índice para queries de mensagens travadas
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_sending_started 
  ON public.broadcast_queue(sending_started_at) 
  WHERE sending_started_at IS NOT NULL AND status = 'sending';

-- Comentário
COMMENT ON COLUMN public.broadcast_queue.sending_started_at IS 'Timestamp de quando o envio começou (para detectar mensagens travadas)';

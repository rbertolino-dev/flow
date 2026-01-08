-- =====================================================
-- FIX: Garantir que colunas de mensagens não lidas existem
-- =====================================================
-- Problema: Webhook retorna erro 500 porque colunas não existem
-- Solução: Adicionar colunas se não existirem

-- Adicionar campos para rastrear mensagens não lidas nos leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS has_unread_messages BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unread_message_count INTEGER DEFAULT 0;

-- Criar função para incrementar contador de mensagens não lidas (se não existir)
CREATE OR REPLACE FUNCTION public.increment_unread_count(lead_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.leads 
  SET unread_message_count = COALESCE(unread_message_count, 0) + 1
  WHERE id = lead_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário
COMMENT ON FUNCTION public.increment_unread_count(UUID) IS 'Incrementa contador de mensagens não lidas de um lead';



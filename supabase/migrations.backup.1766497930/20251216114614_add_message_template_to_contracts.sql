-- Adicionar campo whatsapp_message_template na tabela contracts
-- Permite personalizar a mensagem enviada junto com o PDF e link de assinatura

ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS whatsapp_message_template TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.contracts.whatsapp_message_template IS 'Template personalizado da mensagem WhatsApp. Variáveis disponíveis: {{nome}}, {{numero_contrato}}, {{link_assinatura}}';


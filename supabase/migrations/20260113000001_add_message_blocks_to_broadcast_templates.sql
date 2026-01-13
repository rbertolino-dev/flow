-- Adicionar colunas para blocos de mensagem no template de broadcast
-- Permite enviar 2 blocos de mensagem separados por 2 quebras de linha

ALTER TABLE broadcast_campaign_templates 
ADD COLUMN IF NOT EXISTS message_block_1 TEXT,
ADD COLUMN IF NOT EXISTS message_block_2 TEXT;

-- Comentários para documentação
COMMENT ON COLUMN broadcast_campaign_templates.message_block_1 IS 'Primeiro bloco de mensagem do template';
COMMENT ON COLUMN broadcast_campaign_templates.message_block_2 IS 'Segundo bloco de mensagem do template (opcional, será enviado após o primeiro com 2 quebras de linha)';

-- Adicionar colunas image_url e media_type na tabela broadcast_campaigns
-- Necessário para suportar envio de imagens nas campanhas de broadcast

ALTER TABLE broadcast_campaigns 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Comentários para documentação
COMMENT ON COLUMN broadcast_campaigns.image_url IS 'URL da imagem a ser enviada com a campanha (opcional)';
COMMENT ON COLUMN broadcast_campaigns.media_type IS 'Tipo de mídia: image, video, document (opcional)';

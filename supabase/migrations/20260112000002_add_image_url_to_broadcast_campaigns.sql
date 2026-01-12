-- Adicionar coluna image_url para armazenar URL da imagem da campanha
ALTER TABLE public.broadcast_campaigns
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Comentário na coluna
COMMENT ON COLUMN public.broadcast_campaigns.image_url IS 'URL da imagem que será enviada junto com a mensagem no disparo';

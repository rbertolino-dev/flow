-- Adicionar coluna image_url para armazenar URL da imagem do template
ALTER TABLE public.broadcast_campaign_templates
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Comentário na coluna
COMMENT ON COLUMN public.broadcast_campaign_templates.image_url IS 'URL da imagem que será enviada junto com o template no disparo';

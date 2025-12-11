-- Adicionar suporte a anexos (imagens) nos templates de calendário
ALTER TABLE public.calendar_message_templates
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type text;

-- Comentários
COMMENT ON COLUMN public.calendar_message_templates.media_url IS 'URL da imagem/anexo para o template';
COMMENT ON COLUMN public.calendar_message_templates.media_type IS 'Tipo de mídia: image, document, etc.';


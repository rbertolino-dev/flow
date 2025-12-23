-- Adicionar campos de mídia na tabela message_templates
ALTER TABLE public.message_templates
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video', 'document'));
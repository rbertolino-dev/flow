-- Adicionar colunas de mídia na tabela calendar_message_templates
ALTER TABLE public.calendar_message_templates 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;
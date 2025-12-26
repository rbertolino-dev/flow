-- ============================================
-- Adicionar suporte a anexos (imagens) nos templates de calendário
-- ============================================

-- Adicionar colunas media_url e media_type se não existirem
DO $$
BEGIN
  -- Adicionar media_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendar_message_templates'
      AND column_name = 'media_url'
  ) THEN
    ALTER TABLE public.calendar_message_templates
    ADD COLUMN media_url text;
    
    COMMENT ON COLUMN public.calendar_message_templates.media_url IS 
      'URL da imagem/anexo para o template';
  END IF;

  -- Adicionar media_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendar_message_templates'
      AND column_name = 'media_type'
  ) THEN
    ALTER TABLE public.calendar_message_templates
    ADD COLUMN media_type text;
    
    COMMENT ON COLUMN public.calendar_message_templates.media_type IS 
      'Tipo de mídia: image, document, etc.';
  END IF;
END $$;


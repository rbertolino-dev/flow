-- ============================================
-- FIX: Garantir que coluna message_variations existe
-- ============================================

-- Adicionar coluna message_variations se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaign_templates'
      AND column_name = 'message_variations'
  ) THEN
    ALTER TABLE public.broadcast_campaign_templates
    ADD COLUMN message_variations JSONB DEFAULT '[]'::jsonb;
    
    COMMENT ON COLUMN public.broadcast_campaign_templates.message_variations IS 
      'Array de variações de mensagem em formato JSONB';
  END IF;
END $$;

-- Garantir que a coluna permite NULL (para compatibilidade)
DO $$
BEGIN
  ALTER TABLE public.broadcast_campaign_templates
  ALTER COLUMN message_variations DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Coluna já permite NULL ou não existe NOT NULL constraint
    NULL;
END $$;

-- Criar índice GIN para busca eficiente em message_variations (se houver muitos templates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'broadcast_campaign_templates'
      AND indexname = 'idx_broadcast_campaign_templates_message_variations'
  ) THEN
    CREATE INDEX idx_broadcast_campaign_templates_message_variations
    ON public.broadcast_campaign_templates
    USING GIN (message_variations);
  END IF;
END $$;


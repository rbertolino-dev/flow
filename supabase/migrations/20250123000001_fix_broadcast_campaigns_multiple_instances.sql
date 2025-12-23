-- ============================================
-- FIX: Permitir instance_id NULL para campanhas com múltiplas instâncias
-- ============================================

-- Permitir instance_id NULL quando campanha usa múltiplas instâncias
DO $$
BEGIN
  -- Verificar se a coluna já permite NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_id'
      AND is_nullable = 'NO'
  ) THEN
    -- Remover constraint NOT NULL se existir
    ALTER TABLE public.broadcast_campaigns
    ALTER COLUMN instance_id DROP NOT NULL;
    
    COMMENT ON COLUMN public.broadcast_campaigns.instance_id IS 
      'ID da instância (NULL quando campanha usa múltiplas instâncias - rotate ou separate)';
  END IF;
END $$;

-- Adicionar coluna sending_method se não existir (para rastrear método usado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'sending_method'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN sending_method TEXT DEFAULT 'single';
    
    COMMENT ON COLUMN public.broadcast_campaigns.sending_method IS 
      'Método de envio: single (uma instância), rotate (rotacionar entre instâncias), separate (disparar separadamente)';
  END IF;
END $$;


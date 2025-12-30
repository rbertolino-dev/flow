-- ============================================
-- FIX COMPLETO: Suporte a múltiplas instâncias em broadcast_campaigns
-- ============================================

-- 1. Permitir instance_id NULL quando campanha usa múltiplas instâncias
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

-- 2. Adicionar coluna sending_method se não existir
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
    
    -- Atualizar registros existentes para ter valor padrão
    UPDATE public.broadcast_campaigns
    SET sending_method = 'single'
    WHERE sending_method IS NULL;
  END IF;
END $$;

-- 3. Adicionar coluna instance_ids (array de UUIDs) se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_ids'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN instance_ids UUID[] DEFAULT '{}'::UUID[];
    
    COMMENT ON COLUMN public.broadcast_campaigns.instance_ids IS 
      'IDs das instâncias usadas para enviar mensagens (para modos rotate/separate)';
  END IF;
END $$;

-- 4. Verificar se as colunas foram criadas corretamente
DO $$
DECLARE
  sending_method_exists BOOLEAN;
  instance_ids_exists BOOLEAN;
  instance_id_nullable BOOLEAN;
BEGIN
  -- Verificar sending_method
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'sending_method'
  ) INTO sending_method_exists;
  
  -- Verificar instance_ids
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_ids'
  ) INTO instance_ids_exists;
  
  -- Verificar se instance_id permite NULL
  SELECT is_nullable = 'YES' FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'broadcast_campaigns'
    AND column_name = 'instance_id'
  INTO instance_id_nullable;
  
  -- Log do resultado
  RAISE NOTICE 'sending_method existe: %', sending_method_exists;
  RAISE NOTICE 'instance_ids existe: %', instance_ids_exists;
  RAISE NOTICE 'instance_id permite NULL: %', instance_id_nullable;
END $$;


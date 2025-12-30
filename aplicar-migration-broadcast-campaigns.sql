-- ============================================
-- FIX: Adicionar coluna sending_method e permitir instance_id NULL
-- IMPORTANTE: Execute este SQL no Supabase Dashboard SQL Editor
-- Link: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
-- ============================================

-- PASSO 1: Permitir instance_id NULL quando campanha usa múltiplas instâncias
ALTER TABLE public.broadcast_campaigns
ALTER COLUMN instance_id DROP NOT NULL;

COMMENT ON COLUMN public.broadcast_campaigns.instance_id IS 
  'ID da instância (NULL quando campanha usa múltiplas instâncias - rotate ou separate)';

-- PASSO 2: Adicionar coluna sending_method se não existir
ALTER TABLE public.broadcast_campaigns
ADD COLUMN IF NOT EXISTS sending_method TEXT DEFAULT 'single';

-- PASSO 3: Garantir que sending_method não seja NULL para registros existentes
UPDATE public.broadcast_campaigns
SET sending_method = 'single'
WHERE sending_method IS NULL;

-- PASSO 4: Adicionar constraint para validar valores (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_sending_method'
    AND conrelid = 'public.broadcast_campaigns'::regclass
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD CONSTRAINT valid_sending_method 
    CHECK (sending_method IN ('single', 'rotate', 'separate'));
  END IF;
END $$;

COMMENT ON COLUMN public.broadcast_campaigns.sending_method IS 
  'Método de envio: single (uma instância), rotate (rotacionar entre instâncias), separate (disparar separadamente)';

-- PASSO 5: Verificar se foi aplicado corretamente
SELECT 
  column_name, 
  is_nullable, 
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcast_campaigns' 
  AND column_name IN ('instance_id', 'sending_method')
ORDER BY column_name;

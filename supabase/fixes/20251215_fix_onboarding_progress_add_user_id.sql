-- ============================================
-- FIX: Adicionar coluna user_id em organization_onboarding_progress
-- Execute no Supabase SQL Editor
-- ============================================
-- O código espera a coluna user_id mas ela não existe

-- Adicionar coluna user_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'organization_onboarding_progress' 
      AND column_name = 'user_id'
  ) THEN
    -- Adicionar coluna user_id
    ALTER TABLE public.organization_onboarding_progress 
    ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    
    -- Atualizar registros existentes com o primeiro usuário da organização
    UPDATE public.organization_onboarding_progress oop
    SET user_id = (
      SELECT om.user_id 
      FROM public.organization_members om 
      WHERE om.organization_id = oop.organization_id 
      ORDER BY om.created_at ASC 
      LIMIT 1
    )
    WHERE oop.user_id IS NULL;
    
    -- Tornar NOT NULL após atualizar valores existentes
    ALTER TABLE public.organization_onboarding_progress 
    ALTER COLUMN user_id SET NOT NULL;
    
    RAISE NOTICE '✅ Coluna user_id adicionada';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna user_id já existe';
  END IF;
END $$;

-- Verificar resultado
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'organization_onboarding_progress' 
  AND column_name = 'user_id';


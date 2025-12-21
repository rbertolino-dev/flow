-- ============================================
-- FIX: Remover user_id da tabela tags (se existir)
-- A tabela tags usa apenas organization_id
-- ============================================

-- Verificar se coluna user_id existe e removê-la se necessário
DO $$
BEGIN
  -- Se coluna user_id existe, removê-la
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tags' 
      AND column_name = 'user_id'
  ) THEN
    -- Remover constraints que podem estar usando user_id
    ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_user_id_fkey;
    
    -- Remover coluna user_id
    ALTER TABLE public.tags DROP COLUMN user_id;
    
    RAISE NOTICE 'Coluna user_id removida da tabela tags';
  ELSE
    RAISE NOTICE 'Coluna user_id não existe na tabela tags (já está correto)';
  END IF;
END $$;

-- Garantir que organization_id é NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tags' 
      AND column_name = 'organization_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.tags ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'organization_id definido como NOT NULL';
  END IF;
END $$;

-- Verificar e atualizar políticas RLS se necessário
DO $$
BEGIN
  -- Remover políticas antigas que podem usar user_id
  DROP POLICY IF EXISTS "Users can view their own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can create their own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can update their own tags" ON public.tags;
  DROP POLICY IF EXISTS "Users can delete their own tags" ON public.tags;
  
  -- Garantir que políticas corretas existem (usando organization_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'tags' 
      AND policyname = 'Users can view organization tags'
  ) THEN
    CREATE POLICY "Users can view organization tags"
    ON public.tags FOR SELECT
    USING (organization_id = public.get_user_organization(auth.uid()));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'tags' 
      AND policyname = 'Users can create organization tags'
  ) THEN
    CREATE POLICY "Users can create organization tags"
    ON public.tags FOR INSERT
    WITH CHECK (organization_id = public.get_user_organization(auth.uid()));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'tags' 
      AND policyname = 'Users can update organization tags'
  ) THEN
    CREATE POLICY "Users can update organization tags"
    ON public.tags FOR UPDATE
    USING (organization_id = public.get_user_organization(auth.uid()));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'tags' 
      AND policyname = 'Users can delete organization tags'
  ) THEN
    CREATE POLICY "Users can delete organization tags"
    ON public.tags FOR DELETE
    USING (organization_id = public.get_user_organization(auth.uid()));
  END IF;
END $$;


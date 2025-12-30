-- ============================================
-- FIX: Corrigir erros do cadastro/onboarding
-- ============================================

-- 1. Corrigir foreign key de organization_onboarding_progress
-- Garantir que user_id seja opcional ou referencie auth.users ao invés de profiles
DO $$
BEGIN
  -- Verificar se a tabela existe e tem user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_onboarding_progress'
      AND column_name = 'user_id'
  ) THEN
    -- Remover constraint antiga se existir
    ALTER TABLE public.organization_onboarding_progress
    DROP CONSTRAINT IF EXISTS organization_onboarding_progress_user_id_fkey;
    
    -- Adicionar constraint que referencia auth.users (sempre existe quando usuário está autenticado)
    ALTER TABLE public.organization_onboarding_progress
    ADD CONSTRAINT organization_onboarding_progress_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Garantir que facebook_configs tenha políticas RLS corretas
DO $$
BEGIN
  -- Verificar se tabela existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'facebook_configs'
  ) THEN
    -- Remover políticas antigas se existirem
    DROP POLICY IF EXISTS "facebook_configs_select_org_members" ON public.facebook_configs;
    DROP POLICY IF EXISTS "Users can view their org facebook config" ON public.facebook_configs;
    DROP POLICY IF EXISTS "Users can insert facebook config for their org" ON public.facebook_configs;
    DROP POLICY IF EXISTS "Users can update facebook config of their org" ON public.facebook_configs;
    DROP POLICY IF EXISTS "Users can delete facebook config of their org" ON public.facebook_configs;
    
    -- Criar políticas corretas
    CREATE POLICY "facebook_configs_select_org_members"
    ON public.facebook_configs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
    
    CREATE POLICY "facebook_configs_insert_org_members"
    ON public.facebook_configs FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
    
    CREATE POLICY "facebook_configs_update_org_members"
    ON public.facebook_configs FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
    
    CREATE POLICY "facebook_configs_delete_org_members"
    ON public.facebook_configs FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = facebook_configs.organization_id
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    );
  END IF;
END $$;

-- 3. Garantir que products.price seja sempre NUMERIC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'price'
  ) THEN
    -- Verificar tipo atual
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'price'
        AND data_type != 'numeric'
        AND data_type != 'double precision'
    ) THEN
      -- Converter para NUMERIC se não for
      ALTER TABLE public.products
      ALTER COLUMN price TYPE NUMERIC(10, 2) USING price::NUMERIC(10, 2);
    END IF;
    
    -- Garantir que não seja NULL
    ALTER TABLE public.products
    ALTER COLUMN price SET DEFAULT 0.00;
    
    -- Adicionar constraint para garantir valor positivo
    ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_price_positive;
    
    ALTER TABLE public.products
    ADD CONSTRAINT products_price_positive CHECK (price >= 0);
  END IF;
END $$;

-- 4. Criar função helper para garantir profile existe
CREATE OR REPLACE FUNCTION public.ensure_user_profile(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _profile_id UUID;
BEGIN
  -- Verificar se profile já existe
  SELECT id INTO _profile_id
  FROM public.profiles
  WHERE id = _user_id;
  
  -- Se não existir, criar
  IF _profile_id IS NULL THEN
    INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
    SELECT 
      u.id,
      u.email,
      COALESCE((u.raw_user_meta_data->>'full_name')::TEXT, u.email),
      NOW(),
      NOW()
    FROM auth.users u
    WHERE u.id = _user_id
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO _profile_id;
  END IF;
  
  RETURN _profile_id;
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.ensure_user_profile IS 'Garante que um profile existe para o usuário, criando se necessário';


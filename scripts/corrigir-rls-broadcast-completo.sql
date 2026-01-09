-- ==========================================
-- CORREÇÃO COMPLETA: RLS de Broadcast bloqueando todas organizações
-- ==========================================
-- Problema: Políticas RLS usam is_pubdigital_user() mas função não tem GRANT
-- Resultado: Erro 400 bloqueia TODAS organizações (não apenas pubdigital)
-- ==========================================

-- 1. Garantir que função is_pubdigital_user existe e tem permissões GRANT
CREATE OR REPLACE FUNCTION public.is_pubdigital_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = _user_id
      AND LOWER(o.name) LIKE '%pubdigital%'
  );
END;
$$;

-- Permissões GRANT (OBRIGATÓRIO para RLS funcionar)
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO anon;

-- 2. Garantir que função has_role existe e tem permissões GRANT
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Permissões GRANT (OBRIGATÓRIO para RLS funcionar)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon;

-- 3. Garantir que função user_belongs_to_org existe e tem permissões GRANT (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'user_belongs_to_org'
  ) THEN
    -- Função existe, garantir permissões GRANT
    GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(UUID, UUID) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(UUID, UUID) TO anon;
    
    RAISE NOTICE '✅ Permissões GRANT adicionadas para user_belongs_to_org';
  ELSE
    RAISE NOTICE 'ℹ️  Função user_belongs_to_org não existe (usando políticas alternativas)';
  END IF;
END $$;

-- 4. Verificar se funções foram criadas corretamente
DO $$
BEGIN
  -- Verificar is_pubdigital_user
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'is_pubdigital_user'
      AND pg_get_function_arguments(p.oid) = '_user_id uuid'
  ) THEN
    RAISE EXCEPTION 'Função is_pubdigital_user não foi criada corretamente!';
  END IF;
  
  -- Verificar has_role
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'has_role'
  ) THEN
    RAISE EXCEPTION 'Função has_role não foi criada corretamente!';
  END IF;
  
  RAISE NOTICE '✅ Função is_pubdigital_user criada/atualizada com sucesso';
  RAISE NOTICE '✅ Função has_role criada/atualizada com sucesso';
  RAISE NOTICE '✅ Permissões GRANT configuradas para authenticated e anon';
END $$;

-- 5. Forçar atualização do schema cache do PostgREST (Supabase)
-- Isso garante que as funções fiquem disponíveis via RLS imediatamente
NOTIFY pgrst, 'reload schema';

-- ==========================================
-- VERIFICAÇÃO FINAL
-- ==========================================
-- Após aplicar este SQL:
-- 1. Todas as organizações (incluindo "iclass sistemas") devem conseguir acessar broadcast
-- 2. O erro 400 não deve mais aparecer
-- 3. As políticas RLS devem funcionar corretamente


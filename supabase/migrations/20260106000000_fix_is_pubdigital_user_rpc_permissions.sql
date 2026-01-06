-- ==========================================
-- Migration: Corrigir permissões RPC das funções usadas em RLS
-- ==========================================
-- Problema: Funções usadas em políticas RLS retornam 400 (Bad Request)
-- Causa: Funções existem mas não têm permissões GRANT para authenticated/anon
-- Impacto: Bloqueia TODAS organizações (não apenas pubdigital)
-- Solução: Adicionar GRANT EXECUTE para authenticated e anon
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

-- 3. Garantir que função user_belongs_to_org tem permissões GRANT (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'user_belongs_to_org'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(UUID, UUID) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.user_belongs_to_org(UUID, UUID) TO anon;
  END IF;
END $$;

-- 4. Comentários nas funções
COMMENT ON FUNCTION public.is_pubdigital_user(UUID) IS 
  'Verifica se usuário pertence à organização PubDigital. Usada em políticas RLS.';
COMMENT ON FUNCTION public.has_role(UUID, public.app_role) IS 
  'Verifica se usuário tem role específica. Usada em políticas RLS.';

-- 5. Forçar atualização do schema cache do PostgREST (Supabase)
-- Isso garante que as funções fiquem disponíveis via RLS imediatamente
NOTIFY pgrst, 'reload schema';


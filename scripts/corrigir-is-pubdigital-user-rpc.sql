-- ==========================================
-- CORREÇÃO: Função is_pubdigital_user não acessível via RPC
-- ==========================================
-- Erro: POST /rest/v1/rpc/is_pubdigital_user 400 (Bad Request)
-- Causa: Função existe mas não tem permissões GRANT para authenticated/anon
-- ==========================================

-- 1. Garantir que função existe com assinatura correta
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

-- 2. Garantir permissões GRANT para authenticated e anon (OBRIGATÓRIO para RPC)
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO anon;

-- 3. Verificar se função foi criada corretamente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'is_pubdigital_user'
      AND pg_get_function_arguments(p.oid) = '_user_id uuid'
  ) THEN
    RAISE EXCEPTION 'Função is_pubdigital_user não foi criada corretamente!';
  END IF;
  
  RAISE NOTICE '✅ Função is_pubdigital_user criada/atualizada com sucesso';
  RAISE NOTICE '✅ Permissões GRANT configuradas para authenticated e anon';
END $$;

-- 4. Forçar atualização do schema cache do PostgREST (Supabase)
-- Isso garante que a função fique disponível via RPC imediatamente
NOTIFY pgrst, 'reload schema';

-- ==========================================
-- VERIFICAÇÃO FINAL
-- ==========================================
-- Execute este comando para testar se a função está acessível:
-- SELECT public.is_pubdigital_user('00000000-0000-0000-0000-000000000000'::UUID);
-- 
-- Ou via RPC (deve funcionar agora):
-- SELECT * FROM public.is_pubdigital_user('00000000-0000-0000-0000-000000000000'::UUID);


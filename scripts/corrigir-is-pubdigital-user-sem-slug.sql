-- ==========================================
-- CORREÇÃO URGENTE: Remover referência a coluna slug inexistente
-- ==========================================
-- Erro: "column o.slug does not exist"
-- Causa: Função is_pubdigital_user tenta acessar coluna slug que não existe
-- ==========================================

-- Corrigir função is_pubdigital_user removendo referência a slug
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

-- Garantir permissões GRANT
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO anon;

-- Forçar atualização do schema cache
NOTIFY pgrst, 'reload schema';

-- ==========================================
-- VERIFICAÇÃO
-- ==========================================
-- Após aplicar este SQL:
-- 1. O erro "column o.slug does not exist" deve desaparecer
-- 2. As campanhas devem carregar corretamente
-- 3. Todas as organizações devem conseguir acessar broadcast


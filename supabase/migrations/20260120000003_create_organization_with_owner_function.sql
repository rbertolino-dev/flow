-- ============================================
-- Migration: Criar função create_organization_with_owner
-- ============================================
-- Esta função é crítica para o funcionamento do cadastro/onboarding
-- Ela cria uma organização e associa o usuário como owner em uma única transação
-- Usa SECURITY DEFINER para bypass RLS durante a criação

-- Função para criar organização e associar usuário como owner
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name text, 
  owner_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Validar parâmetros
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RAISE EXCEPTION 'Nome da organização não pode ser vazio';
  END IF;
  
  IF owner_user_id IS NULL THEN
    owner_user_id := auth.uid();
  END IF;
  
  IF owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Criar organização
  INSERT INTO public.organizations(name, created_at, updated_at)
  VALUES (trim(org_name), NOW(), NOW())
  RETURNING id INTO new_org_id;
  
  -- Adicionar usuário como owner
  INSERT INTO public.organization_members(organization_id, user_id, role, created_at)
  VALUES (new_org_id, owner_user_id, 'owner', NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';
  
  RETURN new_org_id;
END;
$$;

-- Comentário para documentação
COMMENT ON FUNCTION public.create_organization_with_owner IS 
  'Cria uma organização e associa o usuário como owner. Usado durante o onboarding. Retorna o ID da organização criada.';

-- Garantir que função tenha permissões corretas
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner TO anon;

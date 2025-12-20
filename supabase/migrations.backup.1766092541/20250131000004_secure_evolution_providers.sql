-- ============================================
-- MIGRAÇÃO: Segurança adicional para Evolution Providers
-- ============================================
-- Garantir que usuários não possam ver ou acessar providers de outras organizações

-- Remover política que permitia usuários verem providers ativos
DROP POLICY IF EXISTS "Users can view active evolution providers" ON public.evolution_providers;

-- Garantir que apenas super admins podem ver providers diretamente
-- Usuários só podem acessar via função RPC que valida permissões

-- Adicionar verificação adicional na função RPC para garantir que apenas retorna o provider da organização do usuário
CREATE OR REPLACE FUNCTION public.get_organization_evolution_provider(_org_id UUID)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  api_url TEXT,
  api_key TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_has_provider BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  -- Verificar se a organização tem um provider configurado
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  ) INTO v_has_provider;

  -- Só retornar dados se houver provider configurado
  IF v_has_provider THEN
    RETURN QUERY
    SELECT 
      ep.id,
      ep.name,
      ep.api_url,
      ep.api_key
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
    LIMIT 1;
  END IF;
  
  -- Se não houver provider, retorna vazio (não gera erro)
  RETURN;
END;
$$;

-- Função auxiliar para verificar se uma organização tem provider configurado (sem retornar dados sensíveis)
CREATE OR REPLACE FUNCTION public.organization_has_evolution_provider(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RETURN false;
  END IF;

  -- Retornar true se houver provider ativo configurado
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON oep.evolution_provider_id = ep.id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  );
END;
$$;



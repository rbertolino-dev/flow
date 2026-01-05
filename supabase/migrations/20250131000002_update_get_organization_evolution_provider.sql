-- ============================================
-- Migration: Atualizar função para retornar múltiplos providers
-- ============================================
-- Atualiza a função get_organization_evolution_provider para retornar todos os providers
-- cadastrados para a organização (não apenas um)

-- Atualizar função para buscar da nova tabela organization_evolution_providers
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
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RETURN;
  END IF;
  
  -- Buscar providers da nova tabela organization_evolution_providers (múltiplos)
  RETURN QUERY
  SELECT 
    ep.id as provider_id,
    ep.name as provider_name,
    ep.api_url,
    ep.api_key
  FROM public.organization_evolution_providers oep
  INNER JOIN public.evolution_providers ep ON ep.id = oep.evolution_provider_id
  WHERE oep.organization_id = _org_id
    AND ep.is_active = true
  ORDER BY ep.name;
  
  -- Se não encontrou na nova tabela, tentar buscar da estrutura antiga (organization_limits)
  -- para manter compatibilidade durante migração
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      ep.id as provider_id,
      ep.name as provider_name,
      ep.api_url,
      ep.api_key
    FROM public.organization_limits ol
    INNER JOIN public.evolution_providers ep ON ep.id = ol.evolution_provider_id
    WHERE ol.organization_id = _org_id
      AND ol.evolution_provider_id IS NOT NULL
      AND ep.is_active = true;
  END IF;
  
  -- Se não encontrou nada, retorna vazio (não gera erro)
  RETURN;
END;
$$;

-- Atualizar função de verificação para usar nova tabela
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
  
  -- Verificar na nova tabela
  IF EXISTS (
    SELECT 1
    FROM public.organization_evolution_providers oep
    INNER JOIN public.evolution_providers ep ON ep.id = oep.evolution_provider_id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Fallback para estrutura antiga
  IF EXISTS (
    SELECT 1
    FROM public.organization_limits ol
    WHERE ol.organization_id = _org_id
      AND ol.evolution_provider_id IS NOT NULL
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.get_organization_evolution_provider IS 'Retorna todos os providers Evolution configurados para uma organização (múltiplos providers suportados)';
COMMENT ON FUNCTION public.organization_has_evolution_provider IS 'Verifica se uma organização tem pelo menos um provider Evolution configurado';


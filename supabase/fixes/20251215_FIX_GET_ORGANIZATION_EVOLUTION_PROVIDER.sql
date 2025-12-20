-- ============================================
-- FIX: Criar função get_organization_evolution_provider
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Função para verificar se organização tem provider
-- ============================================
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
  
  -- Verificar se a organização tem um provider configurado
  -- Primeiro tenta via organization_limits.evolution_provider_id (estrutura mais recente)
  IF EXISTS (
    SELECT 1
    FROM public.organization_limits ol
    INNER JOIN public.evolution_providers ep ON ep.id = ol.evolution_provider_id
    WHERE ol.organization_id = _org_id
      AND ol.evolution_provider_id IS NOT NULL
      AND ep.is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Se não encontrou, tentar via organization_evolution_provider (estrutura antiga)
  -- Só tenta se a tabela existir
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'organization_evolution_provider'
  ) AND EXISTS (
    SELECT 1
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON ep.id = oep.evolution_provider_id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Se não encontrou, retorna false
  RETURN false;
END;
$$;

-- ============================================
-- 2. Função para obter o provider Evolution de uma organização
-- ============================================
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
  
  -- Buscar provider via organization_limits.evolution_provider_id (estrutura mais recente)
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
    AND ep.is_active = true
  LIMIT 1;
  
  -- Se não encontrou via organization_limits, tentar via organization_evolution_provider (estrutura antiga)
  -- Só tenta se a tabela existir
  IF NOT FOUND AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'organization_evolution_provider'
  ) THEN
    RETURN QUERY
    SELECT 
      ep.id as provider_id,
      ep.name as provider_name,
      ep.api_url,
      ep.api_key
    FROM public.organization_evolution_provider oep
    INNER JOIN public.evolution_providers ep ON ep.id = oep.evolution_provider_id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
    LIMIT 1;
  END IF;
  
  -- Se não encontrou nada, retorna vazio (não gera erro)
  RETURN;
END;
$$;

-- ============================================
-- 3. Comentários explicativos
-- ============================================
COMMENT ON FUNCTION public.organization_has_evolution_provider IS 'Verifica se uma organização tem um provider Evolution configurado';
COMMENT ON FUNCTION public.get_organization_evolution_provider IS 'Retorna os dados do provider Evolution configurado para uma organização (apenas para membros da organização)';

-- ============================================
-- 4. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 5. Verificar resultado
-- ============================================
SELECT 
  'organization_has_evolution_provider' as funcao,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' 
      AND routine_name = 'organization_has_evolution_provider'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'get_organization_evolution_provider',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' 
      AND routine_name = 'get_organization_evolution_provider'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)


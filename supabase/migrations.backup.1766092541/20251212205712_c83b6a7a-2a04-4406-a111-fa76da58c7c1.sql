-- Criar funções RPC para gerenciar providers de organizações

-- Função para verificar se organização tem provider associado
CREATE OR REPLACE FUNCTION public.organization_has_evolution_provider(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_limits ol
    WHERE ol.organization_id = _org_id
      AND ol.evolution_provider_id IS NOT NULL
  );
$$;

-- Função para obter o provider Evolution de uma organização
CREATE OR REPLACE FUNCTION public.get_organization_evolution_provider(_org_id uuid)
RETURNS TABLE(
  provider_id uuid,
  provider_name text,
  api_url text,
  api_key text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ep.id as provider_id,
    ep.name as provider_name,
    ep.api_url,
    ep.api_key
  FROM organization_limits ol
  INNER JOIN evolution_providers ep ON ep.id = ol.evolution_provider_id
  WHERE ol.organization_id = _org_id
    AND ep.is_active = true;
$$;
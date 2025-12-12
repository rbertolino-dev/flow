-- ============================================
-- MIGRAÇÃO COMPLETA: Evolution Providers
-- ============================================
-- Aplique este arquivo no Supabase Dashboard > SQL Editor
-- Execute tudo de uma vez

-- ============================================
-- PARTE 1: Criação das tabelas e estruturas
-- ============================================

-- Tabela de providers Evolution (links e API keys disponíveis)
CREATE TABLE IF NOT EXISTS public.evolution_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Nome descritivo do provider (ex: "Evolution Principal", "Evolution Backup")
  api_url TEXT NOT NULL, -- URL da API Evolution
  api_key TEXT NOT NULL, -- API Key do Evolution
  is_active BOOLEAN DEFAULT true, -- Se o provider está ativo
  description TEXT, -- Descrição opcional
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Garantir que não há URLs duplicadas
  UNIQUE(api_url)
);

-- Tabela de relacionamento entre organização e provider Evolution
CREATE TABLE IF NOT EXISTS public.organization_evolution_provider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  evolution_provider_id UUID NOT NULL REFERENCES public.evolution_providers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Uma organização pode ter apenas um provider Evolution ativo
  UNIQUE(organization_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_evolution_providers_active ON public.evolution_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_org_evolution_provider_org ON public.organization_evolution_provider(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_evolution_provider_provider ON public.organization_evolution_provider(evolution_provider_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_evolution_providers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_evolution_providers_updated_at
BEFORE UPDATE ON public.evolution_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_evolution_providers_updated_at();

CREATE OR REPLACE FUNCTION public.update_org_evolution_provider_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_org_evolution_provider_updated_at
BEFORE UPDATE ON public.organization_evolution_provider
FOR EACH ROW
EXECUTE FUNCTION public.update_org_evolution_provider_updated_at();

-- Habilitar RLS
ALTER TABLE public.evolution_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_evolution_provider ENABLE ROW LEVEL SECURITY;

-- Policies RLS para evolution_providers
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all evolution providers"
  ON public.evolution_providers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all evolution providers"
  ON public.evolution_providers
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies RLS para organization_evolution_provider
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all organization evolution providers"
  ON public.organization_evolution_provider
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all organization evolution providers"
  ON public.organization_evolution_provider
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Org owners podem ver o provider da sua organização
CREATE POLICY "Org owners can view their organization evolution provider"
  ON public.organization_evolution_provider
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_evolution_provider.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- PARTE 2: Funções RPC seguras
-- ============================================

-- Função para obter o provider Evolution de uma organização
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

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
-- Verifique se as tabelas foram criadas:
-- SELECT * FROM public.evolution_providers;
-- SELECT * FROM public.organization_evolution_provider;



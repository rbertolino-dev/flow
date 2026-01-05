-- ============================================
-- Migration: Suporte a múltiplos Evolution Providers por organização
-- ============================================
-- Permite que uma organização tenha múltiplos providers Evolution cadastrados

-- Criar tabela de relacionamento many-to-many
CREATE TABLE IF NOT EXISTS public.organization_evolution_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  evolution_provider_id UUID NOT NULL REFERENCES public.evolution_providers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Evitar duplicatas: uma organização não pode ter o mesmo provider duas vezes
  UNIQUE(organization_id, evolution_provider_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_org_evolution_providers_org ON public.organization_evolution_providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_evolution_providers_provider ON public.organization_evolution_providers(evolution_provider_id);

-- Habilitar RLS
ALTER TABLE public.organization_evolution_providers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para super admins
CREATE POLICY "Super admins can view all organization evolution providers"
  ON public.organization_evolution_providers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Super admins can manage all organization evolution providers"
  ON public.organization_evolution_providers
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Políticas RLS para org owners
CREATE POLICY "Org owners can view their organization evolution providers"
  ON public.organization_evolution_providers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_evolution_providers.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_organization_evolution_providers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_organization_evolution_providers_updated_at ON public.organization_evolution_providers;
CREATE TRIGGER trg_update_organization_evolution_providers_updated_at
BEFORE UPDATE ON public.organization_evolution_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_organization_evolution_providers_updated_at();

-- Migrar dados existentes de organization_limits.evolution_provider_id para a nova tabela
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Para cada organização que tem evolution_provider_id em organization_limits
  FOR rec IN 
    SELECT organization_id, evolution_provider_id
    FROM public.organization_limits
    WHERE evolution_provider_id IS NOT NULL
  LOOP
    -- Inserir na nova tabela se não existir
    INSERT INTO public.organization_evolution_providers (organization_id, evolution_provider_id)
    VALUES (rec.organization_id, rec.evolution_provider_id)
    ON CONFLICT (organization_id, evolution_provider_id) DO NOTHING;
  END LOOP;
END $$;

-- Comentários para documentação
COMMENT ON TABLE public.organization_evolution_providers IS 'Relacionamento many-to-many entre organizações e providers Evolution - permite múltiplos providers por organização';
COMMENT ON COLUMN public.organization_evolution_providers.organization_id IS 'ID da organização';
COMMENT ON COLUMN public.organization_evolution_providers.evolution_provider_id IS 'ID do provider Evolution';


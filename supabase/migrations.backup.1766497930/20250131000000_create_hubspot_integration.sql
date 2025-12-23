-- ============================================
-- MIGRAÇÃO: Integração HubSpot
-- ============================================

-- Tabela para armazenar configurações de integração HubSpot por organização
CREATE TABLE IF NOT EXISTS public.hubspot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  portal_id text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  sync_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_hubspot_configs_org
  ON public.hubspot_configs (organization_id);

-- Índice para buscar configurações ativas
CREATE INDEX IF NOT EXISTS idx_hubspot_configs_org_active
  ON public.hubspot_configs (organization_id, is_active)
  WHERE is_active = true;
  
-- Nota: Permitimos múltiplas configurações por organização
-- mas apenas uma deve estar ativa por vez (validação via aplicação)

-- Habilitar RLS
ALTER TABLE public.hubspot_configs ENABLE ROW LEVEL SECURITY;

-- Policies para hubspot_configs
CREATE POLICY "HubSpot config: members can select"
  ON public.hubspot_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot config: members can insert"
  ON public.hubspot_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot config: members can update"
  ON public.hubspot_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot config: members can delete"
  ON public.hubspot_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Tabela para rastrear sincronizações de contatos individuais
CREATE TABLE IF NOT EXISTS public.hubspot_contact_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hubspot_contact_id text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  sync_status text NOT NULL DEFAULT 'success', -- 'success', 'error', 'pending'
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_hubspot_contact_per_org UNIQUE(organization_id, hubspot_contact_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_sync_org
  ON public.hubspot_contact_sync (organization_id);

CREATE INDEX IF NOT EXISTS idx_hubspot_contact_sync_lead
  ON public.hubspot_contact_sync (lead_id);

CREATE INDEX IF NOT EXISTS idx_hubspot_contact_sync_status
  ON public.hubspot_contact_sync (sync_status);

CREATE INDEX IF NOT EXISTS idx_hubspot_contact_sync_hubspot_id
  ON public.hubspot_contact_sync (hubspot_contact_id);

-- Habilitar RLS
ALTER TABLE public.hubspot_contact_sync ENABLE ROW LEVEL SECURITY;

-- Policies para hubspot_contact_sync
CREATE POLICY "HubSpot sync: members can select"
  ON public.hubspot_contact_sync
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_contact_sync.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_contact_sync.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot sync: members can insert"
  ON public.hubspot_contact_sync
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_contact_sync.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_contact_sync.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot sync: members can update"
  ON public.hubspot_contact_sync
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_contact_sync.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_contact_sync.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_hubspot_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_hubspot_contact_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trigger_hubspot_configs_updated_at
  BEFORE UPDATE ON public.hubspot_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hubspot_configs_updated_at();

CREATE TRIGGER trigger_hubspot_contact_sync_updated_at
  BEFORE UPDATE ON public.hubspot_contact_sync
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hubspot_contact_sync_updated_at();


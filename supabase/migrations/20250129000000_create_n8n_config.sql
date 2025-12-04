-- Migração: Configuração de integração n8n por organização
-- Esta tabela armazena configurações de conexão com n8n

-- Tabela para armazenar configurações do n8n
CREATE TABLE IF NOT EXISTS public.n8n_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_url text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_connection_test timestamptz,
  connection_status text DEFAULT 'unknown', -- 'connected', 'disconnected', 'error', 'unknown'
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_n8n_configs_org
  ON public.n8n_configs (organization_id);

-- Habilitar RLS
ALTER TABLE public.n8n_configs ENABLE ROW LEVEL SECURITY;

-- Policies para n8n_configs
CREATE POLICY "n8n config: members can select"
  ON public.n8n_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = n8n_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), n8n_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "n8n config: members can insert"
  ON public.n8n_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = n8n_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), n8n_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "n8n config: members can update"
  ON public.n8n_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = n8n_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), n8n_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "n8n config: members can delete"
  ON public.n8n_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = n8n_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), n8n_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );


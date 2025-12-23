-- Migração: Configuração de integração Gmail por organização
-- Esta tabela armazena apenas tokens OAuth, não armazena emails

-- Tabela para armazenar configurações de contas do Gmail
CREATE TABLE IF NOT EXISTS public.gmail_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_access_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_gmail_configs_org
  ON public.gmail_configs (organization_id);

-- Habilitar RLS
ALTER TABLE public.gmail_configs ENABLE ROW LEVEL SECURITY;

-- Policies para gmail_configs
CREATE POLICY "Gmail config: members can select"
  ON public.gmail_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = gmail_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can insert"
  ON public.gmail_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = gmail_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can update"
  ON public.gmail_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = gmail_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can delete"
  ON public.gmail_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = gmail_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );






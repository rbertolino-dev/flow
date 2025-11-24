-- ============================================
-- MIGRAÇÃO: Integração Gmail
-- Aplicar no Supabase Dashboard > SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.gmail_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_access_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_configs_org_account
  ON public.gmail_configs (organization_id, account_name);

ALTER TABLE public.gmail_configs ENABLE ROW LEVEL SECURITY;

-- Apenas membros da organização podem ver/editar suas configurações Gmail
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

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_gmail_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gmail_configs_updated_at
  BEFORE UPDATE ON public.gmail_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gmail_configs_updated_at();

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================

-- ============================================
-- MIGRAÇÃO: Integrações Gmail e Mercado Pago
-- ============================================

-- GMAIL CONFIGS
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

CREATE POLICY "Gmail config: members can select"
  ON public.gmail_configs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = gmail_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can insert"
  ON public.gmail_configs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = gmail_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can update"
  ON public.gmail_configs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = gmail_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can delete"
  ON public.gmail_configs FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = gmail_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

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

-- MERCADO PAGO CONFIGS
CREATE TABLE IF NOT EXISTS public.mercado_pago_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  access_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mercado_pago_configs_org
  ON public.mercado_pago_configs (organization_id);

ALTER TABLE public.mercado_pago_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mercado Pago config: members can select"
  ON public.mercado_pago_configs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can insert"
  ON public.mercado_pago_configs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can update"
  ON public.mercado_pago_configs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can delete"
  ON public.mercado_pago_configs FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- MERCADO PAGO PAYMENTS
CREATE TABLE IF NOT EXISTS public.mercado_pago_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  mercado_pago_preference_id text NOT NULL,
  valor numeric NOT NULL,
  payment_link text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_org
  ON public.mercado_pago_payments (organization_id);

CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_lead
  ON public.mercado_pago_payments (lead_id);

ALTER TABLE public.mercado_pago_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mercado Pago payments: members can select"
  ON public.mercado_pago_payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_payments.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago payments: members can insert"
  ON public.mercado_pago_payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_payments.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago payments: members can update"
  ON public.mercado_pago_payments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_payments.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.update_mercado_pago_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mercado_pago_configs_updated_at
  BEFORE UPDATE ON public.mercado_pago_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mercado_pago_configs_updated_at();

CREATE OR REPLACE FUNCTION public.update_mercado_pago_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mercado_pago_payments_updated_at
  BEFORE UPDATE ON public.mercado_pago_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mercado_pago_payments_updated_at();

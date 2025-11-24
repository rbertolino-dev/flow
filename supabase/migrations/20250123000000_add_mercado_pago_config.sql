-- Migração: Configuração de integração Mercado Pago por organização

CREATE TABLE IF NOT EXISTS public.mercado_pago_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  access_token text NOT NULL,
  public_key text,
  webhook_url text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mercado_pago_configs_org
  ON public.mercado_pago_configs (organization_id);

ALTER TABLE public.mercado_pago_configs ENABLE ROW LEVEL SECURITY;

-- Apenas membros da organização podem ver/editar sua configuração Mercado Pago
CREATE POLICY "Mercado Pago config: members can select"
  ON public.mercado_pago_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can insert"
  ON public.mercado_pago_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can update"
  ON public.mercado_pago_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
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


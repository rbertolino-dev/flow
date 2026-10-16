-- Webhooks de saída da API pública + default scopes ampliados (v1.2 / v2)

CREATE TABLE IF NOT EXISTS public.organization_api_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.organization_api_keys(id) ON DELETE SET NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[
    'lead.created'::text,
    'lead.updated'::text
  ],
  active boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  last_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_api_webhooks_url_http CHECK (url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS idx_organization_api_webhooks_org
  ON public.organization_api_webhooks (organization_id)
  WHERE active = true;

ALTER TABLE public.organization_api_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_api_webhooks_select ON public.organization_api_webhooks;
CREATE POLICY organization_api_webhooks_select ON public.organization_api_webhooks
  FOR SELECT USING (public.is_org_api_admin(organization_id));

DROP POLICY IF EXISTS organization_api_webhooks_insert ON public.organization_api_webhooks;
CREATE POLICY organization_api_webhooks_insert ON public.organization_api_webhooks
  FOR INSERT WITH CHECK (public.is_org_api_admin(organization_id));

DROP POLICY IF EXISTS organization_api_webhooks_update ON public.organization_api_webhooks;
CREATE POLICY organization_api_webhooks_update ON public.organization_api_webhooks
  FOR UPDATE
  USING (public.is_org_api_admin(organization_id))
  WITH CHECK (public.is_org_api_admin(organization_id));

DROP POLICY IF EXISTS organization_api_webhooks_delete ON public.organization_api_webhooks;
CREATE POLICY organization_api_webhooks_delete ON public.organization_api_webhooks
  FOR DELETE USING (public.is_org_api_admin(organization_id));

COMMENT ON TABLE public.organization_api_webhooks IS
  'Webhooks de saída da API pública. Secret assina X-Agilize-Signature (HMAC-SHA256).';

-- Helper: dispatch webhook (chamado por triggers futuros / edge)
CREATE OR REPLACE FUNCTION public.dispatch_organization_api_webhook_event(
  p_organization_id uuid,
  p_event text,
  p_payload jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Persistência leve para workers/edge consumirem (fila simples via updated_at)
  UPDATE public.organization_api_webhooks
  SET updated_at = now()
  WHERE organization_id = p_organization_id
    AND active = true
    AND p_event = ANY (events);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_organization_api_webhook_event(uuid, text, jsonb) FROM PUBLIC;

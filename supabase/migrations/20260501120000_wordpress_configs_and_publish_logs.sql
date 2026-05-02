-- WordPress REST: credenciais por organização + log de publicações

CREATE TABLE IF NOT EXISTS public.wordpress_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_url text NOT NULL,
  wp_username text NOT NULL,
  application_password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_wordpress_configs_organization_id
  ON public.wordpress_configs (organization_id);

ALTER TABLE public.wordpress_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view wordpress config for their organization" ON public.wordpress_configs;
DROP POLICY IF EXISTS "Users can insert wordpress config for their organization" ON public.wordpress_configs;
DROP POLICY IF EXISTS "Users can update wordpress config for their organization" ON public.wordpress_configs;
DROP POLICY IF EXISTS "Users can delete wordpress config for their organization" ON public.wordpress_configs;

CREATE POLICY "Users can view wordpress config for their organization"
  ON public.wordpress_configs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert wordpress config for their organization"
  ON public.wordpress_configs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update wordpress config for their organization"
  ON public.wordpress_configs FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete wordpress config for their organization"
  ON public.wordpress_configs FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_wordpress_configs_updated_at ON public.wordpress_configs;
CREATE TRIGGER update_wordpress_configs_updated_at
  BEFORE UPDATE ON public.wordpress_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.wordpress_configs IS 'Credenciais WordPress (Application Passwords) por organização para publicação via REST API.';

-- Auditoria de posts publicados (leitura por membros da org; escrita via service role na edge)
CREATE TABLE IF NOT EXISTS public.wordpress_publish_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wp_post_id integer NOT NULL,
  wp_link text,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wordpress_publish_logs_org_created
  ON public.wordpress_publish_logs (organization_id, created_at DESC);

ALTER TABLE public.wordpress_publish_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view wordpress publish logs for their organization" ON public.wordpress_publish_logs;

CREATE POLICY "Users can view wordpress publish logs for their organization"
  ON public.wordpress_publish_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.wordpress_publish_logs IS 'Histórico de posts WordPress criados pelo CRM (inserido pela edge function com service role).';

-- Disponibilizar feature nos planos cujo campo features é um array JSON
UPDATE public.plans p
SET features = COALESCE(p.features, '[]'::jsonb) || '["wordpress_content"]'::jsonb
WHERE jsonb_typeof(COALESCE(p.features, '[]'::jsonb)) = 'array'
  AND NOT (COALESCE(p.features, '[]'::jsonb) @> '"wordpress_content"'::jsonb);

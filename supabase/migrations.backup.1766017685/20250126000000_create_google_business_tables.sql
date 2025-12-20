-- Migração: Configuração de integração Google Business Profile por organização

-- Tabela para armazenar configurações de contas do Google Business Profile
CREATE TABLE IF NOT EXISTS public.google_business_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  business_account_id text,
  location_id text,
  location_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_access_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_google_business_configs_org
  ON public.google_business_configs (organization_id);

CREATE INDEX IF NOT EXISTS idx_google_business_configs_business_account
  ON public.google_business_configs (business_account_id);

-- Tabela para armazenar postagens do Google Business Profile
CREATE TABLE IF NOT EXISTS public.google_business_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_business_config_id uuid NOT NULL REFERENCES public.google_business_configs(id) ON DELETE CASCADE,
  post_type text NOT NULL CHECK (post_type IN ('UPDATE', 'EVENT', 'OFFER', 'PRODUCT')),
  summary text NOT NULL,
  description text,
  call_to_action_type text CHECK (call_to_action_type IN ('CALL', 'BOOK', 'ORDER', 'LEARN_MORE', 'SIGN_UP')),
  call_to_action_url text,
  media_urls jsonb DEFAULT '[]'::jsonb,
  scheduled_for timestamptz NOT NULL,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
  google_post_id text,
  error_message text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para google_business_posts
CREATE INDEX IF NOT EXISTS idx_google_business_posts_org
  ON public.google_business_posts (organization_id);

CREATE INDEX IF NOT EXISTS idx_google_business_posts_config
  ON public.google_business_posts (google_business_config_id);

CREATE INDEX IF NOT EXISTS idx_google_business_posts_status
  ON public.google_business_posts (status);

CREATE INDEX IF NOT EXISTS idx_google_business_posts_scheduled_for
  ON public.google_business_posts (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_google_business_posts_created_at
  ON public.google_business_posts (created_at DESC);

-- Habilitar RLS
ALTER TABLE public.google_business_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_posts ENABLE ROW LEVEL SECURITY;

-- Policies para google_business_configs
CREATE POLICY "Google Business config: members can select"
  ON public.google_business_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business config: members can insert"
  ON public.google_business_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business config: members can update"
  ON public.google_business_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business config: members can delete"
  ON public.google_business_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para google_business_posts
CREATE POLICY "Google Business posts: members can select"
  ON public.google_business_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_posts.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_posts.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business posts: members can insert"
  ON public.google_business_posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_posts.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_posts.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business posts: members can update"
  ON public.google_business_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_posts.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_posts.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business posts: members can delete"
  ON public.google_business_posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_posts.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_posts.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_google_business_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_business_configs_updated_at
  BEFORE UPDATE ON public.google_business_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_business_configs_updated_at();

CREATE OR REPLACE FUNCTION public.update_google_business_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_business_posts_updated_at
  BEFORE UPDATE ON public.google_business_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_business_posts_updated_at();


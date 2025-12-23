-- Criar tabela facebook_configs para gerenciar integrações Facebook/Instagram
CREATE TABLE IF NOT EXISTS public.facebook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT,
  instagram_account_id TEXT,
  instagram_username TEXT,
  instagram_access_token TEXT,
  enabled BOOLEAN DEFAULT true,
  messenger_enabled BOOLEAN DEFAULT true,
  instagram_enabled BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, page_id)
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_facebook_configs_organization ON public.facebook_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_facebook_configs_page_id ON public.facebook_configs(page_id);
CREATE INDEX IF NOT EXISTS idx_facebook_configs_instagram_id ON public.facebook_configs(instagram_account_id);

-- RLS Policies
ALTER TABLE public.facebook_configs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver configs da sua organização
CREATE POLICY "Users can view facebook configs from their organization"
  ON public.facebook_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = facebook_configs.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Administradores podem inserir configs
CREATE POLICY "Admins can insert facebook configs"
  ON public.facebook_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = facebook_configs.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Administradores podem atualizar configs
CREATE POLICY "Admins can update facebook configs"
  ON public.facebook_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = facebook_configs.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Administradores podem deletar configs
CREATE POLICY "Admins can delete facebook configs"
  ON public.facebook_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = facebook_configs.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_facebook_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_facebook_configs_updated_at
  BEFORE UPDATE ON public.facebook_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_facebook_configs_updated_at();
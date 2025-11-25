-- Tabela de configuração do Facebook/Instagram por organização
CREATE TABLE IF NOT EXISTS public.facebook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Identificação da conta conectada
  account_name TEXT NOT NULL DEFAULT 'Página Principal', -- Nome amigável (ex: "Página Principal", "Instagram Oficial")
  
  -- Credenciais fornecidas manualmente
  page_access_token TEXT NOT NULL, -- Token de acesso da página (long-lived)
  page_id TEXT NOT NULL, -- ID da página do Facebook
  
  -- Metadados da página (preenchidos automaticamente ou manualmente)
  page_name TEXT, -- Nome da página
  
  -- Configurações do Instagram (opcional - se a página tem Instagram conectado)
  instagram_account_id TEXT,
  instagram_username TEXT,
  instagram_access_token TEXT, -- Pode ser o mesmo page_access_token
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  messenger_enabled BOOLEAN DEFAULT true,
  instagram_enabled BOOLEAN DEFAULT false,
  
  -- Metadados
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Uma organização pode ter múltiplas páginas/contas
  UNIQUE(organization_id, page_id) -- Evita duplicatas da mesma página
);

-- Index para busca rápida por organização
CREATE INDEX IF NOT EXISTS idx_facebook_configs_org ON public.facebook_configs(organization_id);

-- Index para busca por page_id (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_facebook_configs_page_id ON public.facebook_configs(page_id);

-- Index para busca por instagram_account_id (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_facebook_configs_instagram_id ON public.facebook_configs(instagram_account_id);

-- RLS Policies
ALTER TABLE public.facebook_configs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver configs da própria organização
CREATE POLICY "Users can view their org facebook config"
  ON public.facebook_configs FOR SELECT
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem inserir configs da própria organização
CREATE POLICY "Users can insert their org facebook config"
  ON public.facebook_configs FOR INSERT
  WITH CHECK (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem atualizar configs da própria organização
CREATE POLICY "Users can update their org facebook config"
  ON public.facebook_configs FOR UPDATE
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem deletar configs da própria organização
CREATE POLICY "Users can delete their org facebook config"
  ON public.facebook_configs FOR DELETE
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
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


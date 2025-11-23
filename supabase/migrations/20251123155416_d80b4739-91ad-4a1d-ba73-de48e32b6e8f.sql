-- Tabela de configuração do Chatwoot por organização
CREATE TABLE IF NOT EXISTS public.chatwoot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  chatwoot_base_url TEXT NOT NULL DEFAULT 'https://chat.atendimentoagilize.com',
  chatwoot_account_id INTEGER NOT NULL,
  chatwoot_api_access_token TEXT NOT NULL,
  default_inbox_id INTEGER,
  default_inbox_identifier TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- Index para busca rápida por organização
CREATE INDEX IF NOT EXISTS idx_chatwoot_configs_org ON public.chatwoot_configs(organization_id);

-- RLS Policies
ALTER TABLE public.chatwoot_configs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver configs da própria organização
CREATE POLICY "Users can view their org chatwoot config"
  ON public.chatwoot_configs FOR SELECT
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem inserir configs da própria organização
CREATE POLICY "Users can insert their org chatwoot config"
  ON public.chatwoot_configs FOR INSERT
  WITH CHECK (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem atualizar configs da própria organização
CREATE POLICY "Users can update their org chatwoot config"
  ON public.chatwoot_configs FOR UPDATE
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem deletar configs da própria organização
CREATE POLICY "Users can delete their org chatwoot config"
  ON public.chatwoot_configs FOR DELETE
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_chatwoot_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chatwoot_configs_updated_at
  BEFORE UPDATE ON public.chatwoot_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chatwoot_configs_updated_at();
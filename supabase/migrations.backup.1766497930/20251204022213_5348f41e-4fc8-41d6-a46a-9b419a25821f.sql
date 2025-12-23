-- Criar tabela n8n_configs para integração com n8n
CREATE TABLE IF NOT EXISTS public.n8n_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_connection_test TIMESTAMPTZ,
  connection_status TEXT NOT NULL DEFAULT 'unknown' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Índice para busca por organização
CREATE INDEX IF NOT EXISTS idx_n8n_configs_org ON public.n8n_configs(organization_id);

-- Habilitar RLS
ALTER TABLE public.n8n_configs ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view their org n8n config"
  ON public.n8n_configs FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert their org n8n config"
  ON public.n8n_configs FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update their org n8n config"
  ON public.n8n_configs FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete their org n8n config"
  ON public.n8n_configs FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_n8n_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_n8n_configs_updated_at ON public.n8n_configs;
CREATE TRIGGER trigger_n8n_configs_updated_at
  BEFORE UPDATE ON public.n8n_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_n8n_configs_updated_at();
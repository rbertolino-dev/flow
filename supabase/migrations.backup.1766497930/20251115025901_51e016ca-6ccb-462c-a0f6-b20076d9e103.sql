-- Criar tabela asaas_configs
CREATE TABLE IF NOT EXISTS public.asaas_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  api_key TEXT NOT NULL,
  base_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Criar tabela whatsapp_workflow_groups
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  participant_count INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, group_id, instance_id)
);

-- Habilitar RLS
ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_groups ENABLE ROW LEVEL SECURITY;

-- Policies para asaas_configs
CREATE POLICY "Users can view organization asaas configs"
  ON public.asaas_configs FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization asaas configs"
  ON public.asaas_configs FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization asaas configs"
  ON public.asaas_configs FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization asaas configs"
  ON public.asaas_configs FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can view all asaas configs"
  ON public.asaas_configs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Policies para whatsapp_workflow_groups
CREATE POLICY "Users can view organization workflow groups"
  ON public.whatsapp_workflow_groups FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization workflow groups"
  ON public.whatsapp_workflow_groups FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization workflow groups"
  ON public.whatsapp_workflow_groups FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization workflow groups"
  ON public.whatsapp_workflow_groups FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can view all workflow groups"
  ON public.whatsapp_workflow_groups FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_workflow_groups TO authenticated;

-- Atualizar privilégios padrão
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';
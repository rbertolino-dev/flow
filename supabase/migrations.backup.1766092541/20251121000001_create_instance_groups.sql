-- Tabela para grupos de instâncias WhatsApp
CREATE TABLE IF NOT EXISTS public.instance_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instance_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Índices para performance
DROP INDEX IF EXISTS idx_instance_groups_org CASCADE;
CREATE INDEX idx_instance_groups_org ON
CREATE INDEX idx_instance_groups_org ON public.instance_groups(organization_id);

-- Habilitar RLS
ALTER TABLE public.instance_groups ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view instance groups of their organization"
ON public.instance_groups
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create instance groups for their organization"
ON public.instance_groups
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update instance groups of their organization"
ON public.instance_groups
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete instance groups of their organization"
ON public.instance_groups
FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_instance_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_instance_groups_updated_at
BEFORE UPDATE ON public.instance_groups
FOR EACH ROW
EXECUTE FUNCTION update_instance_groups_updated_at();


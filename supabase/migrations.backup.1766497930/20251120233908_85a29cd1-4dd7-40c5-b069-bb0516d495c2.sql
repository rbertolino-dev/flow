-- ============================================
-- MIGRAÇÃO: Tabelas de Janelas de Horário e Grupos de Instâncias
-- ============================================

-- Tabela para janelas de horário de envio por organização
CREATE TABLE IF NOT EXISTS public.broadcast_time_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Horários de segunda a sexta
  monday_start TIME,
  monday_end TIME,
  tuesday_start TIME,
  tuesday_end TIME,
  wednesday_start TIME,
  wednesday_end TIME,
  thursday_start TIME,
  thursday_end TIME,
  friday_start TIME,
  friday_end TIME,
  -- Horários de sábado
  saturday_start TIME,
  saturday_end TIME,
  -- Horários de domingo
  sunday_start TIME,
  sunday_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_broadcast_time_windows_org ON public.broadcast_time_windows(organization_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_time_windows_enabled ON public.broadcast_time_windows(organization_id, enabled) WHERE enabled = true;

-- Habilitar RLS
ALTER TABLE public.broadcast_time_windows ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Organizations can view their time windows"
ON public.broadcast_time_windows FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can create time windows"
ON public.broadcast_time_windows FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can update their time windows"
ON public.broadcast_time_windows FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can delete their time windows"
ON public.broadcast_time_windows FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_broadcast_time_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_broadcast_time_windows_updated_at
BEFORE UPDATE ON public.broadcast_time_windows
FOR EACH ROW
EXECUTE FUNCTION update_broadcast_time_windows_updated_at();

-- ============================================
-- Tabela de Grupos de Instâncias
-- ============================================

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
CREATE INDEX IF NOT EXISTS idx_instance_groups_org ON public.instance_groups(organization_id);

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

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_instance_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_instance_groups_updated_at
BEFORE UPDATE ON public.instance_groups
FOR EACH ROW
EXECUTE FUNCTION update_instance_groups_updated_at();
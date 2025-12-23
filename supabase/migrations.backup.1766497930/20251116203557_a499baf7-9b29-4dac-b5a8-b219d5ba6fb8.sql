-- ============================================
-- MIGRAÇÃO: OpenAI Configs por Organização
-- ============================================

CREATE TABLE IF NOT EXISTS public.openai_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- RLS
ALTER TABLE public.openai_configs ENABLE ROW LEVEL SECURITY;

-- Apenas membros da organização podem ver/editar
CREATE POLICY "OpenAI config: members can select"
  ON public.openai_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = openai_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), openai_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "OpenAI config: members can insert"
  ON public.openai_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = openai_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), openai_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "OpenAI config: members can update"
  ON public.openai_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = openai_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), openai_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "OpenAI config: members can delete"
  ON public.openai_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = openai_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), openai_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_openai_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_openai_configs_updated_at
  BEFORE UPDATE ON public.openai_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_openai_configs_updated_at();
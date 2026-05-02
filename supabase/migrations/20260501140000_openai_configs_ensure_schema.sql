-- Garantir openai_configs em bases onde a tabela não veio das migrations antigas
-- ou existe sem UNIQUE(organization_id) — o upsert PostgREST exige constraint única.

CREATE TABLE IF NOT EXISTS public.openai_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Manter uma linha por organização (a mais recente)
DELETE FROM public.openai_configs oc
WHERE oc.id IN (
  SELECT id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY organization_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) AS rn
    FROM public.openai_configs
  ) sub
  WHERE sub.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS openai_configs_organization_id_key
  ON public.openai_configs (organization_id);

ALTER TABLE public.openai_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OpenAI config: members can select" ON public.openai_configs;
DROP POLICY IF EXISTS "OpenAI config: members can insert" ON public.openai_configs;
DROP POLICY IF EXISTS "OpenAI config: members can update" ON public.openai_configs;
DROP POLICY IF EXISTS "OpenAI config: members can delete" ON public.openai_configs;

CREATE POLICY "OpenAI config: members can select"
  ON public.openai_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = openai_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), openai_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "OpenAI config: members can insert"
  ON public.openai_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = openai_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), openai_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "OpenAI config: members can update"
  ON public.openai_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = openai_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), openai_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "OpenAI config: members can delete"
  ON public.openai_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = openai_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), openai_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP TRIGGER IF EXISTS trigger_openai_configs_updated_at ON public.openai_configs;
DROP TRIGGER IF EXISTS update_openai_configs_updated_at ON public.openai_configs;
CREATE TRIGGER update_openai_configs_updated_at
  BEFORE UPDATE ON public.openai_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.openai_configs IS 'API key OpenAI por organização (UI Agentes; edge functions com service role).';

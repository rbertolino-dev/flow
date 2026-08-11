-- Templates próprios do Disparador WAHA.
-- Não possui dependência das tabelas ou configurações Evolution.

CREATE TABLE IF NOT EXISTS public.broadcast_templates_waha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  custom_message TEXT NOT NULL,
  sending_method TEXT NOT NULL DEFAULT 'single',
  min_delay_seconds INTEGER NOT NULL DEFAULT 30,
  max_delay_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT broadcast_templates_waha_method_check
    CHECK (sending_method IN ('single', 'rotate', 'separate')),
  CONSTRAINT broadcast_templates_waha_delay_check
    CHECK (
      min_delay_seconds >= 5
      AND max_delay_seconds >= min_delay_seconds
      AND max_delay_seconds <= 3600
    ),
  CONSTRAINT broadcast_templates_waha_org_name_unique
    UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_templates_waha_org
  ON public.broadcast_templates_waha (organization_id, name);

ALTER TABLE public.broadcast_templates_waha ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcast_templates_waha_org_access"
  ON public.broadcast_templates_waha;
CREATE POLICY "broadcast_templates_waha_org_access"
ON public.broadcast_templates_waha FOR ALL
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

COMMENT ON TABLE public.broadcast_templates_waha IS
  'Templates exclusivos do Disparador WAHA, isolados dos templates Evolution.';

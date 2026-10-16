-- Status de agendamento derivados da cor do Google Calendar.
-- Ex.: Sage (2) = reunião realizada; Basil (10) = fechamento.

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_status_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_status_check
  CHECK (status = ANY (ARRAY[
    'scheduled'::text,
    'completed'::text,
    'closing'::text,
    'cancelled'::text,
    'no_show'::text
  ]));

CREATE TABLE IF NOT EXISTS public.calendar_color_status_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  color_id text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY[
    'scheduled'::text,
    'completed'::text,
    'closing'::text,
    'cancelled'::text,
    'no_show'::text
  ])),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, color_id),
  CONSTRAINT calendar_color_status_maps_color_id_check
    CHECK (color_id ~ '^(none|[1-9]|1[01])$')
);

CREATE INDEX IF NOT EXISTS idx_calendar_color_status_maps_org
  ON public.calendar_color_status_maps (organization_id);

ALTER TABLE public.calendar_color_status_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_color_status_maps_select" ON public.calendar_color_status_maps;
CREATE POLICY "calendar_color_status_maps_select"
  ON public.calendar_color_status_maps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = calendar_color_status_maps.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_color_status_maps.organization_id)
  );

DROP POLICY IF EXISTS "calendar_color_status_maps_write" ON public.calendar_color_status_maps;
CREATE POLICY "calendar_color_status_maps_write"
  ON public.calendar_color_status_maps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = calendar_color_status_maps.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_color_status_maps.organization_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = calendar_color_status_maps.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_color_status_maps.organization_id)
  );

COMMENT ON TABLE public.calendar_color_status_maps IS
  'Mapeia colorId do Google Calendar para status do agendamento por organização.';

-- Defaults sugeridos: verde = realizada, verde escuro = fechamento.
INSERT INTO public.calendar_color_status_maps (organization_id, color_id, status, label)
SELECT o.id, d.color_id, d.status, d.label
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('2', 'completed', 'Reunião realizada'),
    ('10', 'closing', 'Fechamento'),
    ('11', 'cancelled', 'Cancelada'),
    ('8', 'no_show', 'Não compareceu')
) AS d(color_id, status, label)
ON CONFLICT (organization_id, color_id) DO NOTHING;

-- Aplica o mapa nos eventos já espelhados.
UPDATE public.calendar_events ce
SET
  status = m.status,
  completed_at = CASE
    WHEN m.status IN ('completed', 'closing') THEN COALESCE(ce.completed_at, now())
    ELSE NULL
  END,
  updated_at = now()
FROM public.calendar_color_status_maps m
WHERE m.organization_id = ce.organization_id
  AND m.color_id = ce.color_id;

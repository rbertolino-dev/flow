-- Múltiplos responsáveis por lead (funil de vendas)
-- Tabela N:N lead_assignees + RLS + backfill a partir de leads.assigned_to + realtime

CREATE TABLE IF NOT EXISTS public.lead_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_assignees_lead_user_unique UNIQUE (lead_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_assignees_lead_id ON public.lead_assignees(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignees_user_id ON public.lead_assignees(user_id);

COMMENT ON TABLE public.lead_assignees IS 'Usuários responsáveis por um lead (múltiplos por lead).';

-- Backfill: assigned_to como UUID
INSERT INTO public.lead_assignees (lead_id, user_id)
SELECT l.id, l.assigned_to::uuid
FROM public.leads l
WHERE l.assigned_to IS NOT NULL
  AND l.assigned_to ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = l.assigned_to::uuid)
ON CONFLICT (lead_id, user_id) DO NOTHING;

-- Backfill: assigned_to como email (não UUID)
INSERT INTO public.lead_assignees (lead_id, user_id)
SELECT l.id, p.id
FROM public.leads l
INNER JOIN public.profiles p ON lower(trim(p.email)) = lower(trim(l.assigned_to))
WHERE l.assigned_to IS NOT NULL
  AND l.assigned_to !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
ON CONFLICT (lead_id, user_id) DO NOTHING;

ALTER TABLE public.lead_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view lead_assignees of their organization leads" ON public.lead_assignees;
DROP POLICY IF EXISTS "Users can insert lead_assignees for their organization leads" ON public.lead_assignees;
DROP POLICY IF EXISTS "Users can delete lead_assignees from their organization leads" ON public.lead_assignees;

CREATE POLICY "Users can view lead_assignees of their organization leads"
ON public.lead_assignees
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_assignees.lead_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert lead_assignees for their organization leads"
ON public.lead_assignees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_assignees.lead_id
      AND om.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.leads l2
    INNER JOIN public.organization_members om2 ON om2.organization_id = l2.organization_id
    WHERE l2.id = lead_assignees.lead_id
      AND om2.user_id = lead_assignees.user_id
  )
);

CREATE POLICY "Users can delete lead_assignees from their organization leads"
ON public.lead_assignees
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_assignees.lead_id
      AND om.user_id = auth.uid()
  )
);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'lead_assignees'
      AND c.relreplident = 'f'
  ) THEN
    ALTER TABLE public.lead_assignees REPLICA IDENTITY FULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lead_assignees'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_assignees;
    END IF;
  END IF;
END $$;

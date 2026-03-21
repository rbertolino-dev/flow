-- Anexos pequenos por lead (CRM / funil): metadados + caminho no Storage

CREATE TABLE IF NOT EXISTS public.lead_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer NOT NULL,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_attachments_size_cap CHECK (file_size > 0 AND file_size <= 2097152)
);

CREATE INDEX IF NOT EXISTS idx_lead_attachments_lead_id ON public.lead_attachments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_attachments_org_id ON public.lead_attachments(organization_id);

COMMENT ON TABLE public.lead_attachments IS 'Arquivos anexados ao lead (ate 2 MB). Bucket whatsapp-workflow-media em org/lead-attachments/lead_id/';

ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_attachments_select_org" ON public.lead_attachments;
DROP POLICY IF EXISTS "lead_attachments_insert_org" ON public.lead_attachments;
DROP POLICY IF EXISTS "lead_attachments_delete_org" ON public.lead_attachments;

CREATE POLICY "lead_attachments_select_org"
ON public.lead_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = lead_attachments.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "lead_attachments_insert_org"
ON public.lead_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    INNER JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_attachments.lead_id
      AND l.organization_id = lead_attachments.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "lead_attachments_delete_org"
ON public.lead_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = lead_attachments.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Realtime: incluir tabela na publicação quando existir (Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'lead_attachments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_attachments;
    END IF;
  END IF;
END $$;

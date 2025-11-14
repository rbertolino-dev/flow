-- 1) Tabela de listas de destinatários específicas para workflows recorrentes
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  list_type text NOT NULL DEFAULT 'list' CHECK (list_type IN ('list', 'single')),
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(contacts) = 'array'),
  default_instance_id uuid REFERENCES public.evolution_config(id),
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_workflow_lists_org_name
  ON public.whatsapp_workflow_lists (organization_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_lists_org
  ON public.whatsapp_workflow_lists (organization_id);

ALTER TABLE public.whatsapp_workflow_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflow lists: members can select"
  ON public.whatsapp_workflow_lists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_lists.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_lists.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow lists: members can insert"
  ON public.whatsapp_workflow_lists
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_lists.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_lists.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow lists: members can update"
  ON public.whatsapp_workflow_lists
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_lists.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_lists.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_lists.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_lists.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow lists: members can delete"
  ON public.whatsapp_workflow_lists
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_lists.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_lists.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE TRIGGER trg_whatsapp_workflow_lists_updated_at
  BEFORE UPDATE ON public.whatsapp_workflow_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Tabela principal de workflows periódicos
CREATE TABLE IF NOT EXISTS public.whatsapp_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_list_id uuid NOT NULL REFERENCES public.whatsapp_workflow_lists(id) ON DELETE CASCADE,
  default_instance_id uuid REFERENCES public.evolution_config(id),
  name text NOT NULL,
  workflow_type text NOT NULL,
  recipient_mode text NOT NULL DEFAULT 'list' CHECK (recipient_mode IN ('list', 'single')),
  periodicity text NOT NULL CHECK (periodicity IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
  days_of_week text[] NOT NULL DEFAULT '{}'::text[] CHECK (
    array_length(days_of_week, 1) IS NULL
    OR days_of_week <@ ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday']::text[]
  ),
  day_of_month integer CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  custom_interval_value integer CHECK (custom_interval_value IS NULL OR custom_interval_value > 0),
  custom_interval_unit text CHECK (custom_interval_unit IS NULL OR custom_interval_unit IN ('day', 'week', 'month')),
  send_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  start_date date NOT NULL,
  end_date date,
  trigger_type text NOT NULL DEFAULT 'fixed' CHECK (trigger_type IN ('fixed', 'before', 'after', 'status')),
  trigger_offset_days integer NOT NULL DEFAULT 0 CHECK (trigger_offset_days BETWEEN -365 AND 365),
  template_mode text NOT NULL DEFAULT 'existing' CHECK (template_mode IN ('existing', 'custom')),
  message_template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  message_body text,
  observations text,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_org
  ON public.whatsapp_workflows (organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_next_run
  ON public.whatsapp_workflows (next_run_at)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_workflows_unique_rule
  ON public.whatsapp_workflows (
    organization_id,
    workflow_list_id,
    workflow_type,
    periodicity,
    send_time,
    trigger_type,
    trigger_offset_days
  )
  WHERE is_active = true;

ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflows: members can select"
  ON public.whatsapp_workflows
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflows.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflows.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflows: members can insert"
  ON public.whatsapp_workflows
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflows.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflows.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflows: members can update"
  ON public.whatsapp_workflows
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflows.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflows.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflows.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflows.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflows: members can delete"
  ON public.whatsapp_workflows
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflows.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflows.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE TRIGGER trg_whatsapp_workflows_updated_at
  BEFORE UPDATE ON public.whatsapp_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Anexos por workflow
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_attachments_workflow
  ON public.whatsapp_workflow_attachments (workflow_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_attachments_org
  ON public.whatsapp_workflow_attachments (organization_id);

ALTER TABLE public.whatsapp_workflow_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflow attachments: members can select"
  ON public.whatsapp_workflow_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_attachments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_attachments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow attachments: members can insert"
  ON public.whatsapp_workflow_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_attachments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_attachments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow attachments: members can delete"
  ON public.whatsapp_workflow_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_attachments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_attachments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- 4) Relacionar scheduled_messages com workflows
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_workflow
  ON public.scheduled_messages (workflow_id);

-- 5) Bucket para anexos (público para permitir acesso pelo Evolution)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'whatsapp-workflow-media'
  ) THEN
    PERFORM storage.create_bucket('whatsapp-workflow-media', true);
  END IF;
END $$;

-- Garantir RLS habilitado em storage.objects (idempotente)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workflow media read" ON storage.objects;
DROP POLICY IF EXISTS "Workflow media insert" ON storage.objects;
DROP POLICY IF EXISTS "Workflow media delete" ON storage.objects;

CREATE POLICY "Workflow media read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-workflow-media'
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = split_part(name, '/', 1)
    )
  );

CREATE POLICY "Workflow media insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-workflow-media'
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = split_part(name, '/', 1)
    )
  );

CREATE POLICY "Workflow media delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-workflow-media'
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = split_part(name, '/', 1)
    )
  );


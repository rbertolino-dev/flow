-- Migração: Arquivos individuais por contato e Fila de Aprovação

-- 1) Tabela para arquivos individuais por contato no workflow
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_contact_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  metadata jsonb DEFAULT '{}'::jsonb, -- Para armazenar informações específicas do PDF (slots de informação)
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, lead_id, contact_phone) -- Um arquivo por contato por workflow
);

CREATE INDEX IF NOT EXISTS idx_workflow_contact_attachments_workflow
  ON public.whatsapp_workflow_contact_attachments (workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_contact_attachments_lead
  ON public.whatsapp_workflow_contact_attachments (lead_id);

CREATE INDEX IF NOT EXISTS idx_workflow_contact_attachments_org
  ON public.whatsapp_workflow_contact_attachments (organization_id);

ALTER TABLE public.whatsapp_workflow_contact_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contact attachments: members can select"
  ON public.whatsapp_workflow_contact_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_contact_attachments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Contact attachments: members can insert"
  ON public.whatsapp_workflow_contact_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_contact_attachments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Contact attachments: members can update"
  ON public.whatsapp_workflow_contact_attachments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_contact_attachments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_contact_attachments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Contact attachments: members can delete"
  ON public.whatsapp_workflow_contact_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_contact_attachments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE TRIGGER trg_workflow_contact_attachments_updated_at
  BEFORE UPDATE ON public.whatsapp_workflow_contact_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Tabela para fila de aprovação
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text,
  message_body text NOT NULL,
  attachment_url text, -- URL do arquivo individual do contato ou do workflow
  attachment_type text,
  attachment_name text,
  approval_date timestamptz, -- Data agendada para aprovação
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow
  ON public.whatsapp_workflow_approvals (workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_scheduled_message
  ON public.whatsapp_workflow_approvals (scheduled_message_id);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status
  ON public.whatsapp_workflow_approvals (status);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approval_date
  ON public.whatsapp_workflow_approvals (approval_date);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_org
  ON public.whatsapp_workflow_approvals (organization_id);

ALTER TABLE public.whatsapp_workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflow approvals: members can select"
  ON public.whatsapp_workflow_approvals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_approvals.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_approvals.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow approvals: members can insert"
  ON public.whatsapp_workflow_approvals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_approvals.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_approvals.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow approvals: members can update"
  ON public.whatsapp_workflow_approvals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_approvals.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_approvals.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_approvals.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_approvals.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow approvals: members can delete"
  ON public.whatsapp_workflow_approvals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_approvals.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_approvals.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE TRIGGER trg_workflow_approvals_updated_at
  BEFORE UPDATE ON public.whatsapp_workflow_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Adicionar campo para habilitar aprovação no workflow
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS approval_deadline_hours integer DEFAULT 24; -- Horas antes do envio para aprovação

-- 4) Adicionar campo de status de aprovação no scheduled_messages
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'not_required' CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_approval_status
  ON public.scheduled_messages (approval_status);


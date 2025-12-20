-- ==========================================
-- PARTE 1: Criar tabelas de workflows
-- ==========================================

-- Tabela principal de workflows periódicos
CREATE TABLE IF NOT EXISTS public.whatsapp_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_list_id UUID NOT NULL,
  default_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  workflow_type TEXT NOT NULL DEFAULT 'marketing',
  recipient_mode TEXT NOT NULL DEFAULT 'list' CHECK (recipient_mode IN ('list', 'single')),
  periodicity TEXT NOT NULL CHECK (periodicity IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
  days_of_week TEXT[],
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  custom_interval_value INTEGER,
  custom_interval_unit TEXT CHECK (custom_interval_unit IN ('day', 'week', 'month')),
  send_time TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  start_date DATE NOT NULL,
  end_date DATE,
  trigger_type TEXT NOT NULL DEFAULT 'fixed' CHECK (trigger_type IN ('fixed', 'before', 'after', 'status')),
  trigger_offset_days INTEGER NOT NULL DEFAULT 0,
  template_mode TEXT NOT NULL DEFAULT 'existing' CHECK (template_mode IN ('existing', 'custom')),
  message_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  message_body TEXT,
  observations TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  requires_approval BOOLEAN DEFAULT false,
  approval_deadline_hours INTEGER,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de listas de contatos para workflows
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  list_type TEXT NOT NULL DEFAULT 'list' CHECK (list_type IN ('list', 'single')),
  contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar FK para workflow_list_id (depois da criação das tabelas)
ALTER TABLE public.whatsapp_workflows
  ADD CONSTRAINT whatsapp_workflows_workflow_list_id_fkey
  FOREIGN KEY (workflow_list_id)
  REFERENCES public.whatsapp_workflow_lists(id)
  ON DELETE CASCADE;

-- Tabela de anexos de workflows
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de anexos individuais por contato
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_contact_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, lead_id, contact_phone)
);

-- Tabela de aprovações de workflows
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  scheduled_message_id UUID REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  message_body TEXT NOT NULL,
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_name TEXT,
  approval_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar campo approval_status em scheduled_messages se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scheduled_messages' 
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.scheduled_messages 
    ADD COLUMN approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected', 'skipped'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scheduled_messages' 
    AND column_name = 'workflow_id'
  ) THEN
    ALTER TABLE public.scheduled_messages 
    ADD COLUMN workflow_id UUID REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ==========================================
-- PARTE 2: Criar índices
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_org ON public.whatsapp_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_next_run ON public.whatsapp_workflows(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_lists_org ON public.whatsapp_workflow_lists(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_attachments_workflow ON public.whatsapp_workflow_attachments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_workflow ON public.whatsapp_workflow_contact_attachments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_workflow ON public.whatsapp_workflow_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_status ON public.whatsapp_workflow_approvals(status) WHERE status = 'pending';

-- ==========================================
-- PARTE 3: Criar storage bucket
-- ==========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-workflow-media', 'whatsapp-workflow-media', true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- PARTE 4: Políticas RLS
-- ==========================================

ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_contact_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_approvals ENABLE ROW LEVEL SECURITY;

-- Políticas para whatsapp_workflows
CREATE POLICY "Users can view org workflows" ON public.whatsapp_workflows
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create org workflows" ON public.whatsapp_workflows
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update org workflows" ON public.whatsapp_workflows
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete org workflows" ON public.whatsapp_workflows
  FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas para whatsapp_workflow_lists
CREATE POLICY "Users can view org lists" ON public.whatsapp_workflow_lists
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create org lists" ON public.whatsapp_workflow_lists
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update org lists" ON public.whatsapp_workflow_lists
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete org lists" ON public.whatsapp_workflow_lists
  FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas para whatsapp_workflow_attachments
CREATE POLICY "Users can view org workflow attachments" ON public.whatsapp_workflow_attachments
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create org workflow attachments" ON public.whatsapp_workflow_attachments
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete org workflow attachments" ON public.whatsapp_workflow_attachments
  FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas para whatsapp_workflow_contact_attachments
CREATE POLICY "Users can view org contact attachments" ON public.whatsapp_workflow_contact_attachments
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create org contact attachments" ON public.whatsapp_workflow_contact_attachments
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update org contact attachments" ON public.whatsapp_workflow_contact_attachments
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete org contact attachments" ON public.whatsapp_workflow_contact_attachments
  FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas para whatsapp_workflow_approvals
CREATE POLICY "Users can view org approvals" ON public.whatsapp_workflow_approvals
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create org approvals" ON public.whatsapp_workflow_approvals
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update org approvals" ON public.whatsapp_workflow_approvals
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas de storage para whatsapp-workflow-media (com cast correto)
CREATE POLICY "Users can view org workflow media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'whatsapp-workflow-media' AND 
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload org workflow media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'whatsapp-workflow-media' AND 
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete org workflow media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'whatsapp-workflow-media' AND 
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );
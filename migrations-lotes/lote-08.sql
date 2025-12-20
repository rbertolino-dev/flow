-- ============================================
-- Lote 8 de Migrations
-- Migrations 141 até 160
-- ============================================

-- ============================================
-- LIMPEZA COMPLETA DE OBJETOS DUPLICADOS
-- ============================================

-- Follow-up Templates - Policies
DROP POLICY IF EXISTS "Etapas de modelo de acompanhamento: os membros podem atualizar" ON public.follow_up_template_steps;
DROP POLICY IF EXISTS "Follow-up template steps: members can update" ON public.follow_up_template_steps;
DROP POLICY IF EXISTS "Follow-up templates: members can select" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can insert" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can update" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can delete" ON public.follow_up_templates;

-- Google Calendar - Triggers e Functions
DROP TRIGGER IF EXISTS trigger_google_calendar_configs_updated_at ON public.google_calendar_configs CASCADE;
DROP FUNCTION IF EXISTS public.update_google_calendar_configs_updated_at() CASCADE;
DROP TRIGGER IF EXISTS trigger_calendar_events_updated_at ON public.calendar_events CASCADE;
DROP FUNCTION IF EXISTS public.update_calendar_events_updated_at() CASCADE;

-- Google Calendar - Policies (todas)
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem selecionar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem inserir" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem atualizar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem excluir" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can select" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can insert" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can update" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can delete" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Calendar events: members can select" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can insert" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can update" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can delete" ON public.calendar_events;

-- Outras policies conhecidas
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
DROP POLICY IF EXISTS "Lead follow-ups: members can select" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "Lead follow-ups: members can update" ON public.lead_follow_ups;

BEGIN;


-- Migration: 20251113021703_18459433-44ab-4fa4-b9ee-56a6fc1a9384.sql
-- Create table for tracking Bubble.io message status
CREATE TABLE IF NOT EXISTS public.bubble_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_bubble_message_tracking_message_id ON public.bubble_message_tracking(message_id);
CREATE INDEX IF NOT EXISTS idx_bubble_message_tracking_phone ON public.bubble_message_tracking(phone);
CREATE INDEX IF NOT EXISTS idx_bubble_message_tracking_organization_id ON public.bubble_message_tracking(organization_id);

-- Enable RLS
ALTER TABLE public.bubble_message_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for bubble_message_tracking
CREATE POLICY "Super admins can view all bubble message tracking"
  ON public.bubble_message_tracking FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can view their org bubble message tracking"
  ON public.bubble_message_tracking FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), organization_id) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Service can insert bubble message tracking"
  ON public.bubble_message_tracking FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update bubble message tracking"
  ON public.bubble_message_tracking FOR UPDATE
  USING (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_bubble_message_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bubble_message_tracking_updated_at
  BEFORE UPDATE ON public.bubble_message_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bubble_message_tracking_updated_at();

-- Migration: 20251114130000_add_whatsapp_workflows.sql
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



-- Migration: 20251114140000_add_workflow_approval_and_contact_files.sql
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



-- Migration: 20251114200854_47adca3d-8e41-4e65-af55-d28056e88b3a.sql
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
DROP POLICY IF EXISTS "Users can view org workflows" ON public.whatsapp_workflows;
CREATE POLICY "Users can view org workflows" ON public.whatsapp_workflows
CREATE POLICY "Users can view org workflows" ON public.whatsapp_workflows
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can create org workflows" ON public.whatsapp_workflows;
CREATE POLICY "Users can create org workflows" ON public.whatsapp_workflows
CREATE POLICY "Users can create org workflows" ON public.whatsapp_workflows
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update org workflows" ON public.whatsapp_workflows;
CREATE POLICY "Users can update org workflows" ON public.whatsapp_workflows
CREATE POLICY "Users can update org workflows" ON public.whatsapp_workflows
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete org workflows" ON public.whatsapp_workflows;
CREATE POLICY "Users can delete org workflows" ON public.whatsapp_workflows
CREATE POLICY "Users can delete org workflows" ON public.whatsapp_workflows
  FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas para whatsapp_workflow_lists
DROP POLICY IF EXISTS "Users can view org lists" ON public.whatsapp_workflow_lists;
CREATE POLICY "Users can view org lists" ON public.whatsapp_workflow_lists
CREATE POLICY "Users can view org lists" ON public.whatsapp_workflow_lists
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can create org lists" ON public.whatsapp_workflow_lists;
CREATE POLICY "Users can create org lists" ON public.whatsapp_workflow_lists
CREATE POLICY "Users can create org lists" ON public.whatsapp_workflow_lists
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update org lists" ON public.whatsapp_workflow_lists;
CREATE POLICY "Users can update org lists" ON public.whatsapp_workflow_lists
CREATE POLICY "Users can update org lists" ON public.whatsapp_workflow_lists
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete org lists" ON public.whatsapp_workflow_lists;
CREATE POLICY "Users can delete org lists" ON public.whatsapp_workflow_lists
CREATE POLICY "Users can delete org lists" ON public.whatsapp_workflow_lists
  FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas para whatsapp_workflow_attachments
DROP POLICY IF EXISTS "Users can view org workflow attachments" ON public.whatsapp_workflow_attachments;
CREATE POLICY "Users can view org workflow attachments" ON public.whatsapp_workflow_attachments
CREATE POLICY "Users can view org workflow attachments" ON public.whatsapp_workflow_attachments
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can create org workflow attachments" ON public.whatsapp_workflow_attachments;
CREATE POLICY "Users can create org workflow attachments" ON public.whatsapp_workflow_attachments
CREATE POLICY "Users can create org workflow attachments" ON public.whatsapp_workflow_attachments
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete org workflow attachments" ON public.whatsapp_workflow_attachments;
CREATE POLICY "Users can delete org workflow attachments" ON public.whatsapp_workflow_attachments
CREATE POLICY "Users can delete org workflow attachments" ON public.whatsapp_workflow_attachments
  FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas para whatsapp_workflow_contact_attachments
DROP POLICY IF EXISTS "Users can view org contact attachments" ON public.whatsapp_workflow_contact_attachments;
CREATE POLICY "Users can view org contact attachments" ON public.whatsapp_workflow_contact_attachments
CREATE POLICY "Users can view org contact attachments" ON public.whatsapp_workflow_contact_attachments
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can create org contact attachments" ON public.whatsapp_workflow_contact_attachments;
CREATE POLICY "Users can create org contact attachments" ON public.whatsapp_workflow_contact_attachments
CREATE POLICY "Users can create org contact attachments" ON public.whatsapp_workflow_contact_attachments
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update org contact attachments" ON public.whatsapp_workflow_contact_attachments;
CREATE POLICY "Users can update org contact attachments" ON public.whatsapp_workflow_contact_attachments
CREATE POLICY "Users can update org contact attachments" ON public.whatsapp_workflow_contact_attachments
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete org contact attachments" ON public.whatsapp_workflow_contact_attachments;
CREATE POLICY "Users can delete org contact attachments" ON public.whatsapp_workflow_contact_attachments
CREATE POLICY "Users can delete org contact attachments" ON public.whatsapp_workflow_contact_attachments
  FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas para whatsapp_workflow_approvals
DROP POLICY IF EXISTS "Users can view org approvals" ON public.whatsapp_workflow_approvals;
CREATE POLICY "Users can view org approvals" ON public.whatsapp_workflow_approvals
CREATE POLICY "Users can view org approvals" ON public.whatsapp_workflow_approvals
  FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can create org approvals" ON public.whatsapp_workflow_approvals;
CREATE POLICY "Users can create org approvals" ON public.whatsapp_workflow_approvals
CREATE POLICY "Users can create org approvals" ON public.whatsapp_workflow_approvals
  FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update org approvals" ON public.whatsapp_workflow_approvals;
CREATE POLICY "Users can update org approvals" ON public.whatsapp_workflow_approvals
CREATE POLICY "Users can update org approvals" ON public.whatsapp_workflow_approvals
  FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

-- Políticas de storage para whatsapp-workflow-media (com cast correto)
DROP POLICY IF EXISTS "Users can view org workflow media" ON storage.objects;
CREATE POLICY "Users can view org workflow media" ON storage.objects
CREATE POLICY "Users can view org workflow media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'whatsapp-workflow-media' AND 
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can upload org workflow media" ON storage.objects;
CREATE POLICY "Users can upload org workflow media" ON storage.objects
CREATE POLICY "Users can upload org workflow media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'whatsapp-workflow-media' AND 
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete org workflow media" ON storage.objects;
CREATE POLICY "Users can delete org workflow media" ON storage.objects
CREATE POLICY "Users can delete org workflow media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'whatsapp-workflow-media' AND 
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Migration: 20251114202447_9c0a1f03-a6d2-4f81-8b32-4b247850f4a6.sql
-- Grant permissions so PostgREST exposes the new workflow tables to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_contact_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_approvals TO authenticated;

-- Future-proof: make new tables in public automatically visible to authenticated users
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Ask PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Migration: 20251114203328_ec8af461-4782-4df0-ab4d-c3bab0576729.sql
-- Grant permissions so PostgREST exposes the new workflow tables to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_contact_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_workflow_approvals TO authenticated;

-- Future-proof: make new tables in public automatically visible to authenticated users
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Ask PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Migration: 20251115000000_add_workflow_groups.sql
-- Migração: Tabela de grupos de WhatsApp para workflows
-- Registra apenas grupos selecionados/usados (registro inteligente para reduzir custos)

CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id text NOT NULL, -- ID do grupo na Evolution API
  group_name text NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  participant_count integer, -- Número de participantes (opcional, para referência)
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único: um grupo só pode ser registrado uma vez por organização/instância
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_workflow_groups_unique
  ON public.whatsapp_workflow_groups (organization_id, group_id, instance_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_groups_org
  ON public.whatsapp_workflow_groups (organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_groups_instance
  ON public.whatsapp_workflow_groups (instance_id);

ALTER TABLE public.whatsapp_workflow_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies para multi-empresa
CREATE POLICY "Workflow groups: members can select"
  ON public.whatsapp_workflow_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_groups.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_groups.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow groups: members can insert"
  ON public.whatsapp_workflow_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_groups.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_groups.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow groups: members can update"
  ON public.whatsapp_workflow_groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_workflow_groups.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_workflow_groups.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Workflow groups: admins can delete"
  ON public.whatsapp_workflow_groups
  FOR DELETE
  USING (
    public.user_is_org_admin(auth.uid(), whatsapp_workflow_groups.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_workflow_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_workflow_groups_updated_at
  BEFORE UPDATE ON public.whatsapp_workflow_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_workflow_groups_updated_at();



-- Migration: 20251115000001_add_monthly_attachments.sql
-- Migração: Adicionar suporte a anexos por mês de cobrança
-- Permite múltiplos anexos por contato (um por mês de referência)

-- Adicionar campo month_reference na tabela de anexos por contato
ALTER TABLE public.whatsapp_workflow_contact_attachments
  ADD COLUMN IF NOT EXISTS month_reference text;

-- Remover constraint UNIQUE antiga (workflow_id, lead_id, contact_phone)
-- Primeiro, verificar se existe e remover
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'whatsapp_workflow_contact_attachments_workflow_id_lead_id_contact_phone_key'
  ) THEN
    ALTER TABLE public.whatsapp_workflow_contact_attachments
      DROP CONSTRAINT whatsapp_workflow_contact_attachments_workflow_id_lead_id_contact_phone_key;
  END IF;
END $$;

-- Criar novo índice UNIQUE incluindo month_reference
-- Permite múltiplos anexos por contato, mas apenas um por mês
-- Usar expressão para tratar NULL como string vazia
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_unique
  ON public.whatsapp_workflow_contact_attachments (
    workflow_id, 
    lead_id, 
    contact_phone, 
    COALESCE(month_reference, '')
  );

-- Índice para busca por mês de referência
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_month
  ON public.whatsapp_workflow_contact_attachments (workflow_id, lead_id, month_reference)
  WHERE month_reference IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_workflow_contact_attachments.month_reference IS 
  'Referência do mês no formato MM/YYYY (ex: 01/2025). Permite múltiplos anexos por contato, um por mês. NULL para anexos gerais (não específicos de mês).';



-- Migration: 20251115000002_update_workflows_for_groups.sql
-- Migração: Adicionar suporte a grupos como destinatários em workflows

-- Adicionar campo recipient_type (substitui/enriquece recipient_mode)
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS recipient_type text NOT NULL DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

-- Adicionar campo group_id (FK para whatsapp_workflow_groups)
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;

-- Índice para busca por grupo
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group
  ON public.whatsapp_workflows (group_id)
  WHERE group_id IS NOT NULL;

-- Índice para busca por tipo de destinatário
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_recipient_type
  ON public.whatsapp_workflows (recipient_type);

-- Migrar dados existentes: se recipient_mode = 'single', recipient_type = 'single', senão 'list'
UPDATE public.whatsapp_workflows
SET recipient_type = CASE 
  WHEN recipient_mode = 'single' THEN 'single'
  ELSE 'list'
END
WHERE recipient_type = 'list' AND recipient_mode IS NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN public.whatsapp_workflows.recipient_type IS 
  'Tipo de destinatário: list (lista de contatos), single (contato único), group (grupo de WhatsApp)';
COMMENT ON COLUMN public.whatsapp_workflows.group_id IS 
  'ID do grupo de WhatsApp (quando recipient_type = group). Referência para whatsapp_workflow_groups.';



-- Migration: 20251115010000_add_asaas_config.sql
-- Migração: Configuração de integração Asaas por organização

CREATE TABLE IF NOT EXISTS public.asaas_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  api_key text NOT NULL,
  base_url text NOT NULL DEFAULT 'https://www.asaas.com/api/v3',
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_configs_org
  ON public.asaas_configs (organization_id);

ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;

-- Apenas membros da organização podem ver/editar sua configuração Asaas
CREATE POLICY "Asaas config: members can select"
  ON public.asaas_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = asaas_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Asaas config: members can insert"
  ON public.asaas_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = asaas_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Asaas config: members can update"
  ON public.asaas_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = asaas_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), asaas_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_asaas_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_asaas_configs_updated_at
  BEFORE UPDATE ON public.asaas_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_asaas_configs_updated_at();




-- Migration: 20251115020000_add_boleto_tracking.sql
-- Migração: Tabela para rastreamento de boletos gerados
-- Permite armazenar e gerenciar boletos gerados via Asaas

CREATE TABLE IF NOT EXISTS public.whatsapp_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  
  -- Dados do Asaas
  asaas_payment_id text NOT NULL UNIQUE,
  asaas_customer_id text NOT NULL,
  
  -- Informações do boleto
  valor decimal(10, 2) NOT NULL,
  data_vencimento date NOT NULL,
  descricao text,
  referencia_externa text,
  
  -- URLs e dados do boleto
  boleto_url text,
  boleto_pdf_url text,
  linha_digitavel text,
  codigo_barras text,
  nosso_numero text,
  
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'paid', 'cancelled', 'overdue', 'refunded')),
  data_pagamento date,
  valor_pago decimal(10, 2),
  
  -- Auditoria
  criado_por uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_org
  ON public.whatsapp_boletos (organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_lead
  ON public.whatsapp_boletos (lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_workflow
  ON public.whatsapp_boletos (workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_asaas_payment_id
  ON public.whatsapp_boletos (asaas_payment_id);

-- RLS
ALTER TABLE public.whatsapp_boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boletos: members can select"
  ON public.whatsapp_boletos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Boletos: members can insert"
  ON public.whatsapp_boletos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Boletos: members can update"
  ON public.whatsapp_boletos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_boletos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_boletos_updated_at
  BEFORE UPDATE ON public.whatsapp_boletos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_boletos_updated_at();



-- Migration: 20251115025901_51e016ca-6ccb-462c-a0f6-b20076d9e103.sql
-- Criar tabela asaas_configs
CREATE TABLE IF NOT EXISTS public.asaas_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  api_key TEXT NOT NULL,
  base_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Criar tabela whatsapp_workflow_groups
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  participant_count INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, group_id, instance_id)
);

-- Habilitar RLS
ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_groups ENABLE ROW LEVEL SECURITY;

-- Policies para asaas_configs
CREATE POLICY "Users can view organization asaas configs"
  ON public.asaas_configs FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization asaas configs"
  ON public.asaas_configs FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization asaas configs"
  ON public.asaas_configs FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization asaas configs"
  ON public.asaas_configs FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can view all asaas configs"
  ON public.asaas_configs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Policies para whatsapp_workflow_groups
CREATE POLICY "Users can view organization workflow groups"
  ON public.whatsapp_workflow_groups FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization workflow groups"
  ON public.whatsapp_workflow_groups FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization workflow groups"
  ON public.whatsapp_workflow_groups FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization workflow groups"
  ON public.whatsapp_workflow_groups FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can view all workflow groups"
  ON public.whatsapp_workflow_groups FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_workflow_groups TO authenticated;

-- Atualizar privilégios padrão
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';

-- Migration: 20251115030143_e9ec4917-3893-4e7f-b1aa-72729ede79c7.sql
-- Adicionar coluna group_id na tabela whatsapp_workflows
ALTER TABLE public.whatsapp_workflows 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group_id 
ON public.whatsapp_workflows(group_id);

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';

-- Migration: 20251116000031_fcaafff1-4f90-473f-88a1-b0ff544a05f3.sql
-- ============================================
-- MIGRAÇÃO: Tabela de Boletos WhatsApp
-- ============================================

-- Criar tabela whatsapp_boletos
CREATE TABLE IF NOT EXISTS public.whatsapp_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  
  -- Dados do Asaas
  asaas_payment_id text NOT NULL,
  asaas_customer_id text NOT NULL,
  
  -- Dados do boleto
  valor numeric NOT NULL,
  data_vencimento date NOT NULL,
  descricao text,
  referencia_externa text,
  
  -- URLs e códigos
  boleto_url text,
  boleto_pdf_url text,
  linha_digitavel text,
  codigo_barras text,
  nosso_numero text,
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_org 
  ON public.whatsapp_boletos(organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_lead 
  ON public.whatsapp_boletos(lead_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_asaas_payment 
  ON public.whatsapp_boletos(asaas_payment_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_status 
  ON public.whatsapp_boletos(status);

-- Habilitar RLS
ALTER TABLE public.whatsapp_boletos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para whatsapp_boletos
CREATE POLICY "Boletos: members can select"
  ON public.whatsapp_boletos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Boletos: members can insert"
  ON public.whatsapp_boletos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Boletos: members can update"
  ON public.whatsapp_boletos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Boletos: members can delete"
  ON public.whatsapp_boletos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem ver todos os boletos
CREATE POLICY "Super admins can view all boletos"
  ON public.whatsapp_boletos
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_boletos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_boletos_updated_at
  BEFORE UPDATE ON public.whatsapp_boletos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_boletos_updated_at();

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================

-- Migration: 20251116030055_09fd7415-55bb-48a0-840b-126fb9c48204.sql
-- Add month_reference column to whatsapp_workflow_contact_attachments
ALTER TABLE whatsapp_workflow_contact_attachments 
ADD COLUMN IF NOT EXISTS month_reference text;

-- Migration: 20251116182339_64130988-8c01-424c-aeb4-60af697df35c.sql
-- ============================================================================
-- OTIMIZAÇÕES DE PERFORMANCE - FUNÇÕES SQL
-- ============================================================================

-- FUNÇÃO 1: get_daily_metrics
-- Reduz de 120 queries (30 dias × 4 queries) para 1 query apenas
CREATE OR REPLACE FUNCTION get_daily_metrics(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS TABLE (
  date date,
  incoming_count bigint,
  broadcast_count bigint,
  scheduled_count bigint,
  leads_count bigint
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  day_date date;
BEGIN
  IF start_date IS NULL OR end_date IS NULL THEN
    RAISE EXCEPTION 'start_date e end_date são obrigatórios';
  END IF;
  
  day_date := DATE(start_date);
  
  WHILE day_date <= DATE(end_date) LOOP
    RETURN QUERY
    SELECT 
      day_date as date,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM whatsapp_messages
        WHERE DATE(timestamp) = day_date
        AND direction = 'incoming'
      ), 0)::bigint as incoming_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM broadcast_queue
        WHERE DATE(sent_at) = day_date
        AND status = 'sent'
      ), 0)::bigint as broadcast_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM scheduled_messages
        WHERE DATE(sent_at) = day_date
        AND status = 'sent'
      ), 0)::bigint as scheduled_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM leads
        WHERE DATE(created_at) <= day_date
        AND deleted_at IS NULL
      ), 0)::bigint as leads_count;
    
    day_date := day_date + INTERVAL '1 day';
  END LOOP;
END;
$$;

COMMENT ON FUNCTION get_daily_metrics(timestamp with time zone, timestamp with time zone) IS 
  'Retorna métricas diárias agregadas para reduzir queries. Retorna todos os dias do intervalo, mesmo sem dados.';

-- FUNÇÃO 2: get_organization_metrics
-- Reduz de 80 queries (10 orgs × 8 queries) para 1 query apenas
CREATE OR REPLACE FUNCTION get_organization_metrics(
  current_month_start timestamp with time zone,
  current_month_end timestamp with time zone,
  previous_month_start timestamp with time zone,
  previous_month_end timestamp with time zone
)
RETURNS TABLE (
  org_id uuid,
  org_name text,
  current_incoming bigint,
  current_broadcast bigint,
  current_scheduled bigint,
  current_leads bigint,
  prev_incoming bigint,
  prev_broadcast bigint,
  prev_scheduled bigint,
  prev_leads bigint
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF current_month_start IS NULL OR current_month_end IS NULL OR
     previous_month_start IS NULL OR previous_month_end IS NULL THEN
    RAISE EXCEPTION 'Todos os parâmetros de data são obrigatórios';
  END IF;

  RETURN QUERY
  SELECT 
    o.id as org_id,
    o.name as org_name,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM whatsapp_messages
      WHERE organization_id = o.id
      AND direction = 'incoming'
      AND timestamp BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_incoming,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM broadcast_queue
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_broadcast,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM scheduled_messages
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_scheduled,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM leads
      WHERE organization_id = o.id
      AND deleted_at IS NULL
    ), 0)::bigint as current_leads,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM whatsapp_messages
      WHERE organization_id = o.id
      AND direction = 'incoming'
      AND timestamp BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_incoming,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM broadcast_queue
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_broadcast,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM scheduled_messages
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_scheduled,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM leads
      WHERE organization_id = o.id
      AND deleted_at IS NULL
      AND created_at <= previous_month_end
    ), 0)::bigint as prev_leads
  FROM organizations o
  ORDER BY o.name;
END;
$$;

COMMENT ON FUNCTION get_organization_metrics(
  timestamp with time zone, 
  timestamp with time zone, 
  timestamp with time zone, 
  timestamp with time zone
) IS 
  'Retorna métricas de todas as organizações para mês atual e anterior de forma otimizada. Reduz de 80 queries para 1 query.';

-- Migration: 20251116200213_e3282999-ac10-4c4e-ba20-9855971dae69.sql
-- Criar tabela de agentes
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  language TEXT DEFAULT 'pt-BR',
  persona JSONB,
  policies JSONB,
  prompt_instructions TEXT,
  guardrails TEXT,
  few_shot_examples TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.6 CHECK (temperature >= 0 AND temperature <= 1),
  model TEXT DEFAULT 'gpt-4o-mini',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  version INTEGER DEFAULT 1,
  openai_assistant_id TEXT,
  evolution_instance_id TEXT,
  evolution_config_id UUID REFERENCES public.evolution_config(id),
  test_mode BOOLEAN DEFAULT true,
  allow_fallback BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de versões de agentes
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, version)
);

-- Criar tabela de métricas de uso de agentes
CREATE TABLE IF NOT EXISTS public.agent_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, metric_date)
);

-- Habilitar RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_usage_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para agents
CREATE POLICY "Users can view agents from their organization"
  ON public.agents FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create agents in their organization"
  ON public.agents FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update agents in their organization"
  ON public.agents FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete agents in their organization"
  ON public.agents FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Políticas RLS para agent_versions
CREATE POLICY "Users can view agent versions from their organization"
  ON public.agent_versions FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM public.agents
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create agent versions in their organization"
  ON public.agent_versions FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT id FROM public.agents
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Políticas RLS para agent_usage_metrics
CREATE POLICY "Users can view agent metrics from their organization"
  ON public.agent_usage_metrics FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM public.agents
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create agent metrics in their organization"
  ON public.agent_usage_metrics FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT id FROM public.agents
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update agent metrics in their organization"
  ON public.agent_usage_metrics FOR UPDATE
  USING (
    agent_id IN (
      SELECT id FROM public.agents
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at_trigger
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION update_agents_updated_at();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON public.agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent_id ON public.agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_metrics_agent_id ON public.agent_usage_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_metrics_date ON public.agent_usage_metrics(metric_date);

-- Migration: 20251116203557_a499baf7-9b29-4dac-b5a8-b219d5ba6fb8.sql
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

-- Migration: 20251116205937_74168c17-8520-4f71-8883-1822df1485e3.sql
-- Add sync_path and sync_method to evolution_config to support flexible endpoints
ALTER TABLE public.evolution_config
  ADD COLUMN IF NOT EXISTS sync_path TEXT DEFAULT '/viewpool/sync-agent',
  ADD COLUMN IF NOT EXISTS sync_method TEXT DEFAULT 'POST';

-- Optional: constrain sync_method to allowed values using a CHECK-like trigger would be better,
-- but for simplicity we keep free-form and validate in edge function.

-- Backfill existing rows to defaults (covers rows created before default applied)
UPDATE public.evolution_config
SET sync_path = COALESCE(sync_path, '/viewpool/sync-agent'),
    sync_method = COALESCE(sync_method, 'POST');

-- Migration: 20251117000000_fix_recipient_type_column.sql
-- ============================================
-- CORREÇÃO: Adicionar coluna recipient_type
-- Esta migração será aplicada automaticamente pelo Lovable
-- ============================================

-- Adicionar campo recipient_type (se não existir)
ALTER TABLE public.whatsapp_workflows
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

-- Atualizar valores existentes antes de tornar NOT NULL
UPDATE public.whatsapp_workflows
SET recipient_type = CASE 
  WHEN recipient_mode = 'single' THEN 'single'
  ELSE 'list'
END
WHERE recipient_type IS NULL;

-- Tornar NOT NULL após garantir valores
DO $$
BEGIN
  -- Verificar se ainda há valores NULL (caso não tenha recipient_mode)
  UPDATE public.whatsapp_workflows
  SET recipient_type = 'list'
  WHERE recipient_type IS NULL;
  
  -- Agora tornar NOT NULL
  ALTER TABLE public.whatsapp_workflows
    ALTER COLUMN recipient_type SET NOT NULL,
    ALTER COLUMN recipient_type SET DEFAULT 'list';
END $$;

-- Adicionar campo group_id (se não existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_workflow_groups') THEN
    ALTER TABLE public.whatsapp_workflows
      ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;
  ELSE
    -- Se a tabela não existir, criar coluna sem foreign key por enquanto
    ALTER TABLE public.whatsapp_workflows
      ADD COLUMN IF NOT EXISTS group_id uuid;
  END IF;
END $$;

-- Índice para busca por grupo
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group
  ON public.whatsapp_workflows (group_id)
  WHERE group_id IS NOT NULL;

-- Índice para busca por tipo de destinatário
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_recipient_type
  ON public.whatsapp_workflows (recipient_type);

-- Comentários explicativos
COMMENT ON COLUMN public.whatsapp_workflows.recipient_type IS 
  'Tipo de destinatário: list (lista de contatos), single (contato único), group (grupo de WhatsApp)';
COMMENT ON COLUMN public.whatsapp_workflows.group_id IS 
  'ID do grupo de WhatsApp (quando recipient_type = group). Referência para whatsapp_workflow_groups.';



COMMIT;

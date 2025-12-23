-- ==========================================
-- CORREÇÃO: Garantir que tabelas e colunas de workflows existam
-- ==========================================
-- Esta migration garante que todas as tabelas e colunas necessárias
-- para o módulo de workflows existam, mesmo se migrations anteriores
-- não foram aplicadas corretamente.

-- 1) Garantir que coluna media_type existe em message_templates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'message_templates' 
    AND column_name = 'media_type'
  ) THEN
    ALTER TABLE public.message_templates 
    ADD COLUMN media_type TEXT CHECK (media_type IN ('image', 'video', 'document'));
    
    COMMENT ON COLUMN public.message_templates.media_type IS 'Tipo de mídia: image, video, document';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'message_templates' 
    AND column_name = 'media_url'
  ) THEN
    ALTER TABLE public.message_templates 
    ADD COLUMN media_url TEXT;
    
    COMMENT ON COLUMN public.message_templates.media_url IS 'URL da mídia anexada ao template';
  END IF;
END $$;

-- 2) Garantir que tabela whatsapp_workflow_lists existe
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  list_type text NOT NULL DEFAULT 'list' CHECK (list_type IN ('list', 'single')),
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(contacts) = 'array'),
  default_instance_id uuid REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Garantir que tabela whatsapp_workflows existe
CREATE TABLE IF NOT EXISTS public.whatsapp_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_list_id uuid REFERENCES public.whatsapp_workflow_lists(id) ON DELETE CASCADE,
  default_instance_id uuid REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  name text NOT NULL,
  workflow_type text NOT NULL DEFAULT 'marketing',
  recipient_mode text NOT NULL DEFAULT 'list' CHECK (recipient_mode IN ('list', 'single', 'group')),
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
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  requires_approval boolean DEFAULT false,
  approval_deadline_hours integer,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Garantir que tabela whatsapp_workflow_attachments existe
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

-- 5) Garantir que tabela whatsapp_workflow_contact_attachments existe
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
  metadata jsonb DEFAULT '{}'::jsonb,
  month_reference text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, lead_id, contact_phone)
);

-- 6) Garantir que tabela whatsapp_workflow_approvals existe
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text,
  message_body text NOT NULL,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  approval_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7) Adicionar colunas faltantes em whatsapp_workflows se necessário
DO $$ 
BEGIN
  -- Adicionar group_id se não existir (apenas se tabela whatsapp_groups existir)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_workflows' 
    AND column_name = 'group_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_groups'
  ) THEN
    ALTER TABLE public.whatsapp_workflows 
    ADD COLUMN group_id uuid REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_workflows' 
    AND column_name = 'group_id'
  ) THEN
    -- Se whatsapp_groups não existe, criar coluna sem FK
    ALTER TABLE public.whatsapp_workflows 
    ADD COLUMN group_id uuid;
  END IF;
  
  -- Adicionar requires_approval se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_workflows' 
    AND column_name = 'requires_approval'
  ) THEN
    ALTER TABLE public.whatsapp_workflows 
    ADD COLUMN requires_approval boolean DEFAULT false;
  END IF;
  
  -- Adicionar approval_deadline_hours se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_workflows' 
    AND column_name = 'approval_deadline_hours'
  ) THEN
    ALTER TABLE public.whatsapp_workflows 
    ADD COLUMN approval_deadline_hours integer;
  END IF;
  
  -- Adicionar created_by se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_workflows' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.whatsapp_workflows 
    ADD COLUMN created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid();
  END IF;
  
  -- Adicionar updated_by se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_workflows' 
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.whatsapp_workflows 
    ADD COLUMN updated_by uuid REFERENCES public.profiles(id);
  END IF;
END $$;

-- 8) Adicionar coluna month_reference em whatsapp_workflow_contact_attachments se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_workflow_contact_attachments' 
    AND column_name = 'month_reference'
  ) THEN
    ALTER TABLE public.whatsapp_workflow_contact_attachments 
    ADD COLUMN month_reference text;
  END IF;
END $$;

-- 9) Adicionar coluna workflow_id em scheduled_messages se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scheduled_messages' 
    AND column_name = 'workflow_id'
  ) THEN
    ALTER TABLE public.scheduled_messages 
    ADD COLUMN workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scheduled_messages' 
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.scheduled_messages 
    ADD COLUMN approval_status text DEFAULT 'not_required' CHECK (approval_status IN ('not_required', 'pending', 'approved', 'rejected', 'skipped'));
  END IF;
END $$;

-- 10) Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_org ON public.whatsapp_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_next_run ON public.whatsapp_workflows(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_lists_org ON public.whatsapp_workflow_lists(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_workflow_lists_org_name ON public.whatsapp_workflow_lists(organization_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_attachments_workflow ON public.whatsapp_workflow_attachments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_attachments_org ON public.whatsapp_workflow_attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_workflow ON public.whatsapp_workflow_contact_attachments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_lead ON public.whatsapp_workflow_contact_attachments(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_org ON public.whatsapp_workflow_contact_attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_workflow ON public.whatsapp_workflow_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_scheduled_message ON public.whatsapp_workflow_approvals(scheduled_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_status ON public.whatsapp_workflow_approvals(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_approval_date ON public.whatsapp_workflow_approvals(approval_date);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_org ON public.whatsapp_workflow_approvals(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_workflow ON public.scheduled_messages(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_approval_status ON public.scheduled_messages(approval_status);

-- 11) Habilitar RLS em todas as tabelas
ALTER TABLE public.whatsapp_workflow_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_contact_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_approvals ENABLE ROW LEVEL SECURITY;

-- 12) Criar políticas RLS usando as funções existentes (se existirem)
-- Políticas para whatsapp_workflow_lists
DO $$ 
BEGIN
  -- Verificar se função user_belongs_to_org existe, senão usar política alternativa
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_belongs_to_org') THEN
    -- Usar função user_belongs_to_org
    DROP POLICY IF EXISTS "Workflow lists: members can select" ON public.whatsapp_workflow_lists;
    CREATE POLICY "Workflow lists: members can select" ON public.whatsapp_workflow_lists
      FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflow lists: members can insert" ON public.whatsapp_workflow_lists;
    CREATE POLICY "Workflow lists: members can insert" ON public.whatsapp_workflow_lists
      FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflow lists: members can update" ON public.whatsapp_workflow_lists;
    CREATE POLICY "Workflow lists: members can update" ON public.whatsapp_workflow_lists
      FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflow lists: members can delete" ON public.whatsapp_workflow_lists;
    CREATE POLICY "Workflow lists: members can delete" ON public.whatsapp_workflow_lists
      FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));
  ELSE
    -- Usar política alternativa com organization_members
    DROP POLICY IF EXISTS "Workflow lists: members can select" ON public.whatsapp_workflow_lists;
    CREATE POLICY "Workflow lists: members can select" ON public.whatsapp_workflow_lists
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_lists.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflow lists: members can insert" ON public.whatsapp_workflow_lists;
    CREATE POLICY "Workflow lists: members can insert" ON public.whatsapp_workflow_lists
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_lists.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflow lists: members can update" ON public.whatsapp_workflow_lists;
    CREATE POLICY "Workflow lists: members can update" ON public.whatsapp_workflow_lists
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_lists.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflow lists: members can delete" ON public.whatsapp_workflow_lists;
    CREATE POLICY "Workflow lists: members can delete" ON public.whatsapp_workflow_lists
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_lists.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;
END $$;

-- Políticas para whatsapp_workflows
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_belongs_to_org') THEN
    DROP POLICY IF EXISTS "Workflows: members can select" ON public.whatsapp_workflows;
    CREATE POLICY "Workflows: members can select" ON public.whatsapp_workflows
      FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflows: members can insert" ON public.whatsapp_workflows;
    CREATE POLICY "Workflows: members can insert" ON public.whatsapp_workflows
      FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflows: members can update" ON public.whatsapp_workflows;
    CREATE POLICY "Workflows: members can update" ON public.whatsapp_workflows
      FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflows: members can delete" ON public.whatsapp_workflows;
    CREATE POLICY "Workflows: members can delete" ON public.whatsapp_workflows
      FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));
  ELSE
    DROP POLICY IF EXISTS "Workflows: members can select" ON public.whatsapp_workflows;
    CREATE POLICY "Workflows: members can select" ON public.whatsapp_workflows
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflows.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflows: members can insert" ON public.whatsapp_workflows;
    CREATE POLICY "Workflows: members can insert" ON public.whatsapp_workflows
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflows.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflows: members can update" ON public.whatsapp_workflows;
    CREATE POLICY "Workflows: members can update" ON public.whatsapp_workflows
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflows.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflows: members can delete" ON public.whatsapp_workflows;
    CREATE POLICY "Workflows: members can delete" ON public.whatsapp_workflows
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflows.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;
END $$;

-- Políticas para whatsapp_workflow_approvals
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_belongs_to_org') THEN
    DROP POLICY IF EXISTS "Workflow approvals: members can select" ON public.whatsapp_workflow_approvals;
    CREATE POLICY "Workflow approvals: members can select" ON public.whatsapp_workflow_approvals
      FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflow approvals: members can insert" ON public.whatsapp_workflow_approvals;
    CREATE POLICY "Workflow approvals: members can insert" ON public.whatsapp_workflow_approvals
      FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflow approvals: members can update" ON public.whatsapp_workflow_approvals;
    CREATE POLICY "Workflow approvals: members can update" ON public.whatsapp_workflow_approvals
      FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));
  ELSE
    DROP POLICY IF EXISTS "Workflow approvals: members can select" ON public.whatsapp_workflow_approvals;
    CREATE POLICY "Workflow approvals: members can select" ON public.whatsapp_workflow_approvals
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_approvals.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflow approvals: members can insert" ON public.whatsapp_workflow_approvals;
    CREATE POLICY "Workflow approvals: members can insert" ON public.whatsapp_workflow_approvals
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_approvals.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflow approvals: members can update" ON public.whatsapp_workflow_approvals;
    CREATE POLICY "Workflow approvals: members can update" ON public.whatsapp_workflow_approvals
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_approvals.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;
END $$;

-- Políticas para whatsapp_workflow_attachments
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_belongs_to_org') THEN
    DROP POLICY IF EXISTS "Workflow attachments: members can select" ON public.whatsapp_workflow_attachments;
    CREATE POLICY "Workflow attachments: members can select" ON public.whatsapp_workflow_attachments
      FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflow attachments: members can insert" ON public.whatsapp_workflow_attachments;
    CREATE POLICY "Workflow attachments: members can insert" ON public.whatsapp_workflow_attachments
      FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Workflow attachments: members can delete" ON public.whatsapp_workflow_attachments;
    CREATE POLICY "Workflow attachments: members can delete" ON public.whatsapp_workflow_attachments
      FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));
  ELSE
    DROP POLICY IF EXISTS "Workflow attachments: members can select" ON public.whatsapp_workflow_attachments;
    CREATE POLICY "Workflow attachments: members can select" ON public.whatsapp_workflow_attachments
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_attachments.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflow attachments: members can insert" ON public.whatsapp_workflow_attachments;
    CREATE POLICY "Workflow attachments: members can insert" ON public.whatsapp_workflow_attachments
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_attachments.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Workflow attachments: members can delete" ON public.whatsapp_workflow_attachments;
    CREATE POLICY "Workflow attachments: members can delete" ON public.whatsapp_workflow_attachments
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_attachments.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;
END $$;

-- Políticas para whatsapp_workflow_contact_attachments
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_belongs_to_org') THEN
    DROP POLICY IF EXISTS "Contact attachments: members can select" ON public.whatsapp_workflow_contact_attachments;
    CREATE POLICY "Contact attachments: members can select" ON public.whatsapp_workflow_contact_attachments
      FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Contact attachments: members can insert" ON public.whatsapp_workflow_contact_attachments;
    CREATE POLICY "Contact attachments: members can insert" ON public.whatsapp_workflow_contact_attachments
      FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Contact attachments: members can update" ON public.whatsapp_workflow_contact_attachments;
    CREATE POLICY "Contact attachments: members can update" ON public.whatsapp_workflow_contact_attachments
      FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));

    DROP POLICY IF EXISTS "Contact attachments: members can delete" ON public.whatsapp_workflow_contact_attachments;
    CREATE POLICY "Contact attachments: members can delete" ON public.whatsapp_workflow_contact_attachments
      FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));
  ELSE
    DROP POLICY IF EXISTS "Contact attachments: members can select" ON public.whatsapp_workflow_contact_attachments;
    CREATE POLICY "Contact attachments: members can select" ON public.whatsapp_workflow_contact_attachments
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Contact attachments: members can insert" ON public.whatsapp_workflow_contact_attachments;
    CREATE POLICY "Contact attachments: members can insert" ON public.whatsapp_workflow_contact_attachments
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Contact attachments: members can update" ON public.whatsapp_workflow_contact_attachments;
    CREATE POLICY "Contact attachments: members can update" ON public.whatsapp_workflow_contact_attachments
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );

    DROP POLICY IF EXISTS "Contact attachments: members can delete" ON public.whatsapp_workflow_contact_attachments;
    CREATE POLICY "Contact attachments: members can delete" ON public.whatsapp_workflow_contact_attachments
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = whatsapp_workflow_contact_attachments.organization_id
            AND om.user_id = auth.uid()
        )
        OR public.is_pubdigital_user(auth.uid())
      );
  END IF;
END $$;

-- 13) Criar triggers para updated_at se não existirem
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_workflow_lists_updated_at ON public.whatsapp_workflow_lists;
CREATE TRIGGER trg_whatsapp_workflow_lists_updated_at
  BEFORE UPDATE ON public.whatsapp_workflow_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_whatsapp_workflows_updated_at ON public.whatsapp_workflows;
CREATE TRIGGER trg_whatsapp_workflows_updated_at
  BEFORE UPDATE ON public.whatsapp_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_workflow_contact_attachments_updated_at ON public.whatsapp_workflow_contact_attachments;
CREATE TRIGGER trg_workflow_contact_attachments_updated_at
  BEFORE UPDATE ON public.whatsapp_workflow_contact_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_workflow_approvals_updated_at ON public.whatsapp_workflow_approvals;
CREATE TRIGGER trg_workflow_approvals_updated_at
  BEFORE UPDATE ON public.whatsapp_workflow_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 14) Garantir que workflow_list_id pode ser NULL (para grupos)
DO $$ 
BEGIN
  -- Verificar se constraint NOT NULL existe e remover se necessário
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'whatsapp_workflows'
      AND tc.constraint_type = 'NOT NULL'
      AND ccu.column_name = 'workflow_list_id'
  ) THEN
    -- Não podemos remover NOT NULL diretamente, mas podemos alterar a coluna
    ALTER TABLE public.whatsapp_workflows 
    ALTER COLUMN workflow_list_id DROP NOT NULL;
  END IF;
END $$;


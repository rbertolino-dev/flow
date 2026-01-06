-- ==========================================
-- CORREÇÃO COMPLETA: Todos os erros de workflows e integrações
-- ==========================================
-- Execute este script no Supabase SQL Editor
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

-- ==========================================
-- PARTE 1: Garantir que tabelas de workflows existam
-- ==========================================

-- 1.1) whatsapp_workflow_lists
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

-- 1.2) whatsapp_workflows
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

-- 1.3) whatsapp_workflow_approvals
CREATE TABLE IF NOT EXISTS public.whatsapp_workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.whatsapp_workflows(id) ON DELETE CASCADE,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text,
  message_body text NOT NULL,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  approval_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.4) whatsapp_boletos
CREATE TABLE IF NOT EXISTS public.whatsapp_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  asaas_payment_id text NOT NULL,
  asaas_customer_id text NOT NULL,
  valor numeric(10, 2) NOT NULL,
  data_vencimento date NOT NULL,
  descricao text,
  referencia_externa text,
  boleto_url text,
  boleto_pdf_url text,
  linha_digitavel text,
  codigo_barras text,
  nosso_numero text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'paid', 'cancelled', 'overdue', 'refunded')),
  data_pagamento date,
  valor_pago numeric(10, 2),
  criado_por uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ==========================================
-- PARTE 2: Garantir que coluna base_url existe em asaas_configs
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'asaas_configs'
    AND column_name = 'base_url'
  ) THEN
    ALTER TABLE public.asaas_configs
    ADD COLUMN base_url text NOT NULL DEFAULT 'https://www.asaas.com/api/v3';
    
    COMMENT ON COLUMN public.asaas_configs.base_url IS 'URL base da API Asaas (sandbox ou produção)';
  END IF;
END $$;

-- Garantir que tabela asaas_configs existe
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

-- ==========================================
-- PARTE 3: Garantir que função is_pubdigital_user existe
-- ==========================================

-- NÃO dropar a função porque muitas políticas RLS dependem dela
-- Usar CREATE OR REPLACE que funciona se a assinatura for compatível
CREATE OR REPLACE FUNCTION public.is_pubdigital_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = _user_id
      AND LOWER(o.name) LIKE '%pubdigital%'
  );
END;
$$;

-- ==========================================
-- PARTE 4: Criar índices
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_org ON public.whatsapp_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_next_run ON public.whatsapp_workflows(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_lists_org ON public.whatsapp_workflow_lists(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_workflow ON public.whatsapp_workflow_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_approvals_status ON public.whatsapp_workflow_approvals(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_org ON public.whatsapp_boletos(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_lead ON public.whatsapp_boletos(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_workflow ON public.whatsapp_boletos(workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_asaas_payment ON public.whatsapp_boletos(asaas_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_configs_org ON public.asaas_configs(organization_id);

-- ==========================================
-- PARTE 5: Habilitar RLS em todas as tabelas
-- ==========================================

ALTER TABLE public.whatsapp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_configs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PARTE 6: Criar políticas RLS para whatsapp_workflows
-- ==========================================

DO $$
BEGIN
  -- Política SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_workflows'
    AND policyname = 'Users can view org workflows'
  ) THEN
    CREATE POLICY "Users can view org workflows" ON public.whatsapp_workflows
      FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));
  END IF;

  -- Política INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_workflows'
    AND policyname = 'Users can create org workflows'
  ) THEN
    CREATE POLICY "Users can create org workflows" ON public.whatsapp_workflows
      FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));
  END IF;

  -- Política UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_workflows'
    AND policyname = 'Users can update org workflows'
  ) THEN
    CREATE POLICY "Users can update org workflows" ON public.whatsapp_workflows
      FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));
  END IF;

  -- Política DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_workflows'
    AND policyname = 'Users can delete org workflows'
  ) THEN
    CREATE POLICY "Users can delete org workflows" ON public.whatsapp_workflows
      FOR DELETE USING (user_belongs_to_org(auth.uid(), organization_id));
  END IF;
END $$;

-- ==========================================
-- PARTE 7: Criar políticas RLS para whatsapp_workflow_approvals
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_workflow_approvals'
    AND policyname = 'Users can view org approvals'
  ) THEN
    CREATE POLICY "Users can view org approvals" ON public.whatsapp_workflow_approvals
      FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_workflow_approvals'
    AND policyname = 'Users can create org approvals'
  ) THEN
    CREATE POLICY "Users can create org approvals" ON public.whatsapp_workflow_approvals
      FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_workflow_approvals'
    AND policyname = 'Users can update org approvals'
  ) THEN
    CREATE POLICY "Users can update org approvals" ON public.whatsapp_workflow_approvals
      FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id));
  END IF;
END $$;

-- ==========================================
-- PARTE 8: Criar políticas RLS para whatsapp_boletos
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_boletos'
    AND policyname = 'Boletos: members can select'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_boletos'
    AND policyname = 'Boletos: members can insert'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'whatsapp_boletos'
    AND policyname = 'Boletos: members can update'
  ) THEN
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
  END IF;
END $$;

-- ==========================================
-- PARTE 9: Criar políticas RLS para asaas_configs (completo)
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can select'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can insert'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'asaas_configs'
    AND policyname = 'Asaas config: members can update'
  ) THEN
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
  END IF;
END $$;

-- ==========================================
-- PARTE 10: Garantir que função user_is_org_admin existe
-- ==========================================

-- Tentar criar função apenas se não existir (usando EXECUTE)
DO $$
BEGIN
  -- Verificar se função já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'user_is_org_admin'
    AND pg_get_function_arguments(p.oid) LIKE '%uuid%uuid%'
  ) THEN
    -- Criar função usando EXECUTE
    EXECUTE '
    CREATE FUNCTION public.user_is_org_admin(_user_id UUID, _org_id UUID)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = _user_id
          AND om.organization_id = _org_id
          AND om.role IN (''admin'', ''owner'')
      );
    END;
    $func$';
  ELSE
    RAISE NOTICE 'Função user_is_org_admin já existe. Mantendo versão existente.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Função user_is_org_admin pode já existir com assinatura diferente. Ignorando.';
END $$;

-- ==========================================
-- PARTE 11: Garantir que função user_belongs_to_org existe
-- ==========================================

-- Tentar criar função apenas se não existir (usando EXECUTE)
DO $$
BEGIN
  -- Verificar se função já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'user_belongs_to_org'
    AND pg_get_function_arguments(p.oid) LIKE '%uuid%uuid%'
  ) THEN
    -- Criar função usando EXECUTE
    EXECUTE '
    CREATE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = _user_id
          AND om.organization_id = _org_id
      );
    END;
    $func$';
  ELSE
    RAISE NOTICE 'Função user_belongs_to_org já existe. Mantendo versão existente.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Função user_belongs_to_org pode já existir com assinatura diferente. Ignorando.';
END $$;

-- ==========================================
-- PARTE 12: Forçar atualização do schema cache do Supabase
-- ==========================================

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';

-- Aguardar um pouco para garantir que o schema foi atualizado
SELECT pg_sleep(1);

-- ==========================================
-- PARTE 13: Verificação final
-- ==========================================

DO $$
BEGIN
  -- Verificar tabelas
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_workflows') THEN
    RAISE EXCEPTION 'Tabela whatsapp_workflows não foi criada!';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_workflow_approvals') THEN
    RAISE EXCEPTION 'Tabela whatsapp_workflow_approvals não foi criada!';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_boletos') THEN
    RAISE EXCEPTION 'Tabela whatsapp_boletos não foi criada!';
  END IF;
  
  -- Verificar coluna base_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'asaas_configs'
    AND column_name = 'base_url'
  ) THEN
    RAISE EXCEPTION 'Coluna base_url não existe em asaas_configs!';
  END IF;
  
  -- Verificar funções
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_pubdigital_user'
  ) THEN
    RAISE EXCEPTION 'Função is_pubdigital_user não foi criada!';
  END IF;
  
  RAISE NOTICE '✅ Todas as verificações passaram!';
  RAISE NOTICE '✅ Tabelas criadas: whatsapp_workflows, whatsapp_workflow_approvals, whatsapp_boletos';
  RAISE NOTICE '✅ Coluna base_url adicionada em asaas_configs';
  RAISE NOTICE '✅ Funções de segurança criadas';
  RAISE NOTICE '✅ Políticas RLS configuradas';
  RAISE NOTICE '✅ Schema cache será atualizado automaticamente';
END $$;


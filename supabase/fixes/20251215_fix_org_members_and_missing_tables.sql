-- ============================================
-- FIX 1: Criar tabela user_roles PRIMEIRO (antes de usar nas policies)
--        (evita 404 em /rest/v1/user_roles)
-- ============================================

-- Criar enum se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- Criar tabela user_roles se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'user_roles'
  ) THEN
    CREATE TABLE public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      role public.app_role NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    );

    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

    -- Todos podem ver roles (para verificar permissões)
    CREATE POLICY "Everyone can view user roles"
    ON public.user_roles
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Criar função has_role (fora do bloco DO para evitar erro de sintaxe)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Criar policy de gerenciamento de roles (apenas admins)
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


-- ============================================
-- FIX 2: RLS de organization_members (remover recursão infinita)
-- ============================================
--
-- Problema visto no frontend:
--   infinite recursion detected in policy for relation "organization_members"
--
-- Causa: policy de SELECT fazia um SELECT na própria tabela
--        organization_members, gerando recursão.
--
-- Este bloco simplifica as policies para evitar recursão e
-- continua garantindo segurança.

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas problemáticas (se existirem)
DROP POLICY IF EXISTS "Users can view members of their organization" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_select_self" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_admin_manage" ON public.organization_members;

-- Usuário autenticado só vê os próprios vínculos de organização
CREATE POLICY "org_members_select_self"
ON public.organization_members
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

-- Admin global (tabela user_roles) pode gerenciar todos os membros
CREATE POLICY "org_members_admin_manage"
ON public.organization_members
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);


-- ============================================
-- FIX 3: Criar tabela automation_flows se ainda não existir
--        (necessária antes de flow_executions)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'automation_flows'
  ) THEN
    CREATE TABLE public.automation_flows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
      flow_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
      created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT unique_flow_name_per_org UNIQUE(organization_id, name)
    );

    ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

    -- Policies básicas para automation_flows
    CREATE POLICY "automation_flows_select_org_members"
    ON public.automation_flows
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = automation_flows.organization_id
      )
    );

    CREATE POLICY "automation_flows_manage_org_members"
    ON public.automation_flows
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = automation_flows.organization_id
          AND om.role IN ('owner', 'admin')
      )
    );
  END IF;
END $$;


-- ============================================
-- FIX 4: Criar tabela flow_executions se ainda não existir
--        (baseado na migration 20250125000000_create_automation_flows.sql)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'flow_executions'
  ) THEN

    CREATE TABLE public.flow_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id UUID NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
      lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'running', 'completed', 'cancelled', 'failed')),
      current_node_id UUID,
      execution_data JSONB DEFAULT '{}'::jsonb,
      next_execution_at TIMESTAMPTZ,
      last_execution_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_flow_executions_flow 
      ON public.flow_executions(flow_id);
    CREATE INDEX IF NOT EXISTS idx_flow_executions_lead 
      ON public.flow_executions(lead_id);
    CREATE INDEX IF NOT EXISTS idx_flow_executions_org
      ON public.flow_executions(organization_id);
    CREATE INDEX IF NOT EXISTS idx_flow_executions_next_exec 
      ON public.flow_executions(next_execution_at) 
      WHERE status = 'waiting';

    ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

    -- Policies simplificadas: membros da organização podem gerenciar execuções da própria org
    CREATE POLICY "flow_exec_select_org_members"
    ON public.flow_executions
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = flow_executions.organization_id
      )
    );

    CREATE POLICY "flow_exec_manage_org_members"
    ON public.flow_executions
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = flow_executions.organization_id
          AND om.role IN ('owner', 'admin')
      )
    );

    COMMENT ON TABLE public.flow_executions IS 'Execuções ativas de fluxos de automação para cada lead';
  END IF;
END $$;



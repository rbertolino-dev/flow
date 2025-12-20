-- ============================================
-- FIX: Verificar e corrigir módulo Fluxo Automatizado
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Garantir que função update_updated_at_column existe
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Criar tabela automation_flows
-- ============================================
CREATE TABLE IF NOT EXISTS public.automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  
  -- Armazena o JSON do canvas (nodes + edges)
  flow_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  
  -- Metadados
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: nome único por organização
  CONSTRAINT unique_flow_name_per_org UNIQUE(organization_id, name)
);

-- Índices para automation_flows
CREATE INDEX IF NOT EXISTS idx_automation_flows_org ON public.automation_flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_status ON public.automation_flows(status);
CREATE INDEX IF NOT EXISTS idx_automation_flows_org_status ON public.automation_flows(organization_id, status);

-- RLS para automation_flows
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para automation_flows
DROP POLICY IF EXISTS "automation_flows: members can select" ON public.automation_flows;
CREATE POLICY "automation_flows: members can select"
  ON public.automation_flows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automation_flows.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "automation_flows: members can insert" ON public.automation_flows;
CREATE POLICY "automation_flows: members can insert"
  ON public.automation_flows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automation_flows.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "automation_flows: members can update" ON public.automation_flows;
CREATE POLICY "automation_flows: members can update"
  ON public.automation_flows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automation_flows.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automation_flows.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "automation_flows: members can delete" ON public.automation_flows;
CREATE POLICY "automation_flows: members can delete"
  ON public.automation_flows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automation_flows.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_automation_flows_updated_at ON public.automation_flows;
CREATE TRIGGER update_automation_flows_updated_at
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. Criar tabela flow_executions
-- ============================================
CREATE TABLE IF NOT EXISTS public.flow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Estado atual da execução
  current_node_id TEXT, -- ID do nó atual no canvas
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'waiting', 'completed', 'paused', 'error')),
  
  -- Dados de contexto da execução
  execution_data JSONB DEFAULT '{}'::jsonb, -- Variáveis, histórico, etc.
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ, -- Para esperas agendadas
  
  -- Auditoria
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remover constraint se existir para recriar
DO $$
BEGIN
  -- Tentar remover constraint se existir
  ALTER TABLE public.flow_executions 
  DROP CONSTRAINT IF EXISTS unique_active_execution_per_flow_lead;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Recriar constraint
ALTER TABLE public.flow_executions
ADD CONSTRAINT unique_active_execution_per_flow_lead 
UNIQUE(flow_id, lead_id) DEFERRABLE INITIALLY DEFERRED;

-- Índices para flow_executions
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow ON public.flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_lead ON public.flow_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_status ON public.flow_executions(status);
CREATE INDEX IF NOT EXISTS idx_flow_executions_org ON public.flow_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_next_exec ON public.flow_executions(next_execution_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_lead ON public.flow_executions(flow_id, lead_id);

-- RLS para flow_executions
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para flow_executions
DROP POLICY IF EXISTS "flow_executions: members can select" ON public.flow_executions;
CREATE POLICY "flow_executions: members can select"
  ON public.flow_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = flow_executions.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "flow_executions: members can insert" ON public.flow_executions;
CREATE POLICY "flow_executions: members can insert"
  ON public.flow_executions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = flow_executions.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "flow_executions: members can update" ON public.flow_executions;
CREATE POLICY "flow_executions: members can update"
  ON public.flow_executions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = flow_executions.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = flow_executions.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "flow_executions: members can delete" ON public.flow_executions;
CREATE POLICY "flow_executions: members can delete"
  ON public.flow_executions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = flow_executions.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Adicionar created_at e updated_at se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'flow_executions' 
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.flow_executions 
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'flow_executions' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.flow_executions 
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Trigger para updated_at em flow_executions
DROP TRIGGER IF EXISTS update_flow_executions_updated_at ON public.flow_executions;
CREATE TRIGGER update_flow_executions_updated_at
  BEFORE UPDATE ON public.flow_executions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. Adicionar tabelas ao realtime (opcional)
-- ============================================
DO $$
BEGIN
  -- Tentar adicionar ao realtime (pode falhar se já existir)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_flows;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.flow_executions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- 5. Comentários explicativos
-- ============================================
COMMENT ON TABLE public.automation_flows IS 'Fluxos de automação visual criados pelos usuários';
COMMENT ON COLUMN public.automation_flows.flow_data IS 'JSON contendo nodes e edges do canvas (formato React Flow)';
COMMENT ON TABLE public.flow_executions IS 'Execuções ativas de fluxos de automação para cada lead';
COMMENT ON COLUMN public.flow_executions.current_node_id IS 'ID do nó atual no canvas onde o lead está';
COMMENT ON COLUMN public.flow_executions.execution_data IS 'Dados de contexto da execução (variáveis, histórico, etc.)';
COMMENT ON COLUMN public.flow_executions.next_execution_at IS 'Data/hora da próxima execução (para blocos de espera)';

-- ============================================
-- 6. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 7. Verificar resultado
-- ============================================
SELECT 
  'automation_flows' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'automation_flows'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'automation_flows' 
      AND column_name = 'flow_data'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END as colunas
UNION ALL
SELECT 
  'flow_executions',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'flow_executions'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'flow_executions' 
      AND column_name = 'execution_data'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)


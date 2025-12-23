-- Migração: Sistema de Fluxos de Automação Visual
-- Permite criar jornadas de automação em formato visual (canvas drag-and-drop)

-- Tabela de Fluxos de Automação (visual)
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

-- Tabela de Execução de Fluxos (contato em execução)
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
  
  -- Constraint: um lead só pode ter uma execução ativa por fluxo
  CONSTRAINT unique_active_execution_per_flow_lead UNIQUE(flow_id, lead_id) DEFERRABLE INITIALLY DEFERRED
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_automation_flows_org ON public.automation_flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_status ON public.automation_flows(status);
CREATE INDEX IF NOT EXISTS idx_automation_flows_org_status ON public.automation_flows(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_flow_executions_flow ON public.flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_lead ON public.flow_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_status ON public.flow_executions(status);
CREATE INDEX IF NOT EXISTS idx_flow_executions_org ON public.flow_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_next_exec ON public.flow_executions(next_execution_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_lead ON public.flow_executions(flow_id, lead_id);

-- Habilitar RLS
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

-- Policies para automation_flows
CREATE POLICY "automation_flows: members can select"
  ON public.automation_flows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automation_flows.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "automation_flows: members can insert"
  ON public.automation_flows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automation_flows.organization_id
        AND om.user_id = auth.uid()
    )
  );

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

CREATE POLICY "automation_flows: members can delete"
  ON public.automation_flows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automation_flows.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para flow_executions
CREATE POLICY "flow_executions: members can select"
  ON public.flow_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = flow_executions.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "flow_executions: members can insert"
  ON public.flow_executions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = flow_executions.organization_id
        AND om.user_id = auth.uid()
    )
  );

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

CREATE POLICY "flow_executions: members can delete"
  ON public.flow_executions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = flow_executions.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_automation_flows_updated_at
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar tabelas ao realtime (opcional, para atualizações em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_flows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flow_executions;

-- Comentários explicativos
COMMENT ON TABLE public.automation_flows IS 'Fluxos de automação visual criados pelos usuários';
COMMENT ON COLUMN public.automation_flows.flow_data IS 'JSON contendo nodes e edges do canvas (formato React Flow)';
COMMENT ON TABLE public.flow_executions IS 'Execuções ativas de fluxos de automação para cada lead';
COMMENT ON COLUMN public.flow_executions.current_node_id IS 'ID do nó atual no canvas onde o lead está';
COMMENT ON COLUMN public.flow_executions.execution_data IS 'Dados de contexto da execução (variáveis, histórico, etc.)';
COMMENT ON COLUMN public.flow_executions.next_execution_at IS 'Data/hora da próxima execução (para blocos de espera)';


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
-- Tabelas de agentes (IA / Evolution): existiam só em backups; sem isto o PostgREST devolve 404 em /rest/v1/agents

CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  language text DEFAULT 'pt-BR',
  persona jsonb,
  policies jsonb,
  prompt_instructions text,
  guardrails text,
  few_shot_examples text,
  temperature numeric(3, 2) DEFAULT 0.6 CHECK (temperature >= 0 AND temperature <= 1),
  model text DEFAULT 'gpt-4o-mini',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  version integer DEFAULT 1,
  openai_assistant_id text,
  evolution_instance_id text,
  evolution_config_id uuid REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  test_mode boolean DEFAULT true,
  allow_fallback boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  trigger_type text DEFAULT 'keyword',
  trigger_operator text DEFAULT 'contains',
  trigger_value text,
  expire integer DEFAULT 20,
  keyword_finish text DEFAULT '#SAIR',
  delay_message integer DEFAULT 1000,
  unknown_message text DEFAULT 'Desculpe, não entendi. Pode repetir?',
  listening_from_me boolean DEFAULT false,
  stop_bot_from_me boolean DEFAULT false,
  keep_open boolean DEFAULT true,
  debounce_time integer DEFAULT 10,
  ignore_jids jsonb DEFAULT '[]'::jsonb,
  function_url text,
  response_format text,
  split_messages integer
);

CREATE TABLE IF NOT EXISTS public.agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);

CREATE TABLE IF NOT EXISTS public.agent_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  total_requests integer NOT NULL DEFAULT 0,
  total_cost numeric(10, 4) NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON public.agents (organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents (status);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent_id ON public.agent_versions (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_metrics_agent_id ON public.agent_usage_metrics (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_metrics_date ON public.agent_usage_metrics (metric_date);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_usage_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view agents from their organization" ON public.agents;
DROP POLICY IF EXISTS "Users can create agents in their organization" ON public.agents;
DROP POLICY IF EXISTS "Users can update agents in their organization" ON public.agents;
DROP POLICY IF EXISTS "Users can delete agents in their organization" ON public.agents;

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

DROP POLICY IF EXISTS "Users can view agent versions from their organization" ON public.agent_versions;
DROP POLICY IF EXISTS "Users can create agent versions in their organization" ON public.agent_versions;

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

DROP POLICY IF EXISTS "Users can view agent metrics from their organization" ON public.agent_usage_metrics;
DROP POLICY IF EXISTS "Users can create agent metrics in their organization" ON public.agent_usage_metrics;
DROP POLICY IF EXISTS "Users can update agent metrics in their organization" ON public.agent_usage_metrics;

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

DROP TRIGGER IF EXISTS agents_updated_at_trigger ON public.agents;
DROP TRIGGER IF EXISTS trg_agents_updated_at ON public.agents;
CREATE TRIGGER agents_updated_at_trigger
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.agents IS 'Agentes de IA / Evolution por organização.';

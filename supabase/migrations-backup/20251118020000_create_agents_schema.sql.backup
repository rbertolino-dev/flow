-- Criação das tabelas relacionadas aos agentes inteligentes gerenciados pela plataforma
-- Objetivo: centralizar ciclo de vida e métricas dos agentes integrados com OpenAI / Evolution

CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  language text DEFAULT 'pt-BR',
  persona jsonb DEFAULT '{}'::jsonb,
  policies jsonb DEFAULT '[]'::jsonb,
  prompt_instructions text,
  temperature numeric(3,2) DEFAULT 0.60,
  model text DEFAULT 'gpt-4o-mini',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','archived')),
  version integer NOT NULL DEFAULT 1,
  openai_assistant_id text,
  evolution_instance_id text,
  evolution_config_id uuid REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  test_mode boolean NOT NULL DEFAULT false,
  allow_fallback boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_org_name
  ON public.agents(organization_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_agents_openai
  ON public.agents(openai_assistant_id)
  WHERE openai_assistant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agents_evolution
  ON public.agents(evolution_instance_id)
  WHERE evolution_instance_id IS NOT NULL;

-- Versões históricas de agentes para rollback/auditoria
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_agent
  ON public.agent_versions(agent_id);

-- Métricas diárias/agregadas por agente
CREATE TABLE IF NOT EXISTS public.agent_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  total_requests integer NOT NULL DEFAULT 0,
  total_cost numeric(12,4) NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_usage_metrics_agent
  ON public.agent_usage_metrics(agent_id, metric_date DESC);

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agents_updated_at ON public.agents;
CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_agents_updated_at();



-- ============================================
-- Lote 2 de Migrations
-- Migrations 21 até 40
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


-- Migration: 20250124000000_create_facebook_configs.sql
-- Tabela de configuração do Facebook/Instagram por organização
-- Permite múltiplas páginas/contas por organização (diferente do Chatwoot que é UNIQUE por org)

CREATE TABLE IF NOT EXISTS public.facebook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Identificação da conta conectada
  account_name TEXT NOT NULL, -- Nome amigável (ex: "Página Principal", "Instagram Oficial")
  
  -- Credenciais fornecidas manualmente
  page_access_token TEXT NOT NULL, -- Token de acesso da página (long-lived)
  page_id TEXT NOT NULL, -- ID da página do Facebook
  page_name TEXT, -- Nome da página (preenchido automaticamente ou manualmente)
  
  -- Configurações do Instagram (opcional - se a página tem Instagram conectado)
  instagram_account_id TEXT,
  instagram_username TEXT,
  instagram_access_token TEXT, -- Pode ser o mesmo page_access_token
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  messenger_enabled BOOLEAN DEFAULT true,
  instagram_enabled BOOLEAN DEFAULT false,
  
  -- Metadados
  last_sync_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Uma organização pode ter múltiplas páginas/contas
  UNIQUE(organization_id, page_id) -- Evita duplicatas da mesma página
);

-- Index para busca rápida por organização
CREATE INDEX IF NOT EXISTS idx_facebook_configs_org ON public.facebook_configs(organization_id);

-- Index para busca por page_id (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_facebook_configs_page_id ON public.facebook_configs(page_id);

-- Index para busca por instagram_account_id (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_facebook_configs_instagram_id ON public.facebook_configs(instagram_account_id);

-- RLS Policies
ALTER TABLE public.facebook_configs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver configs da própria organização
CREATE POLICY "Users can view their org facebook config"
  ON public.facebook_configs FOR SELECT
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem inserir configs da própria organização
CREATE POLICY "Users can insert their org facebook config"
  ON public.facebook_configs FOR INSERT
  WITH CHECK (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem atualizar configs da própria organização
CREATE POLICY "Users can update their org facebook config"
  ON public.facebook_configs FOR UPDATE
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem deletar configs da própria organização
CREATE POLICY "Users can delete their org facebook config"
  ON public.facebook_configs FOR DELETE
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_facebook_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_facebook_configs_updated_at
  BEFORE UPDATE ON public.facebook_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_facebook_configs_updated_at();



-- Migration: 20250124000000_create_form_builders.sql
-- Criar tabela de formulários
CREATE TABLE IF NOT EXISTS public.form_builders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  style jsonb NOT NULL DEFAULT '{
    "primaryColor": "#3b82f6",
    "secondaryColor": "#64748b",
    "backgroundColor": "#ffffff",
    "textColor": "#1e293b",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "16px",
    "borderRadius": "8px",
    "buttonStyle": "filled",
    "buttonColor": "#3b82f6",
    "buttonTextColor": "#ffffff",
    "inputBorderColor": "#e2e8f0",
    "inputFocusColor": "#3b82f6"
  }'::jsonb,
  success_message text DEFAULT 'Obrigado! Seus dados foram enviados com sucesso.',
  redirect_url text,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_form_builders_org ON public.form_builders(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_builders_active ON public.form_builders(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.form_builders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forms from their organization"
  ON public.form_builders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create forms in their organization"
  ON public.form_builders FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update forms in their organization"
  ON public.form_builders FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete forms in their organization"
  ON public.form_builders FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_form_builders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER form_builders_updated_at
  BEFORE UPDATE ON public.form_builders
  FOR EACH ROW
  EXECUTE FUNCTION update_form_builders_updated_at();

-- Tabela para submissões de formulários (opcional, para histórico)
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.form_builders(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON public.form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_org ON public.form_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_lead ON public.form_submissions(lead_id);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view submissions from their organization"
  ON public.form_submissions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );



-- Migration: 20250125000000_create_automation_flows.sql
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



-- Migration: 20250125000000_create_facebook_configs.sql
-- Tabela de configuração do Facebook/Instagram por organização
CREATE TABLE IF NOT EXISTS public.facebook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Identificação da conta conectada
  account_name TEXT NOT NULL DEFAULT 'Página Principal', -- Nome amigável (ex: "Página Principal", "Instagram Oficial")
  
  -- Credenciais fornecidas manualmente
  page_access_token TEXT NOT NULL, -- Token de acesso da página (long-lived)
  page_id TEXT NOT NULL, -- ID da página do Facebook
  
  -- Metadados da página (preenchidos automaticamente ou manualmente)
  page_name TEXT, -- Nome da página
  
  -- Configurações do Instagram (opcional - se a página tem Instagram conectado)
  instagram_account_id TEXT,
  instagram_username TEXT,
  instagram_access_token TEXT, -- Pode ser o mesmo page_access_token
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  messenger_enabled BOOLEAN DEFAULT true,
  instagram_enabled BOOLEAN DEFAULT false,
  
  -- Metadados
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Uma organização pode ter múltiplas páginas/contas
  UNIQUE(organization_id, page_id) -- Evita duplicatas da mesma página
);

-- Index para busca rápida por organização
CREATE INDEX IF NOT EXISTS idx_facebook_configs_org ON public.facebook_configs(organization_id);

-- Index para busca por page_id (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_facebook_configs_page_id ON public.facebook_configs(page_id);

-- Index para busca por instagram_account_id (usado no webhook)
CREATE INDEX IF NOT EXISTS idx_facebook_configs_instagram_id ON public.facebook_configs(instagram_account_id);

-- RLS Policies
ALTER TABLE public.facebook_configs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver configs da própria organização
CREATE POLICY "Users can view their org facebook config"
  ON public.facebook_configs FOR SELECT
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem inserir configs da própria organização
CREATE POLICY "Users can insert their org facebook config"
  ON public.facebook_configs FOR INSERT
  WITH CHECK (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem atualizar configs da própria organização
CREATE POLICY "Users can update their org facebook config"
  ON public.facebook_configs FOR UPDATE
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Usuários podem deletar configs da própria organização
CREATE POLICY "Users can delete their org facebook config"
  ON public.facebook_configs FOR DELETE
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_facebook_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_facebook_configs_updated_at
  BEFORE UPDATE ON public.facebook_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_facebook_configs_updated_at();



-- Migration: 20250126000000_add_lead_tags_rls_policies.sql
-- Adicionar políticas RLS para lead_tags
-- Permitir que usuários gerenciem etiquetas de leads da sua organização

-- Habilitar RLS se ainda não estiver habilitado
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: usuários podem ver lead_tags de leads da sua organização
DROP POLICY IF EXISTS "Users can view lead_tags of their organization leads" ON public.lead_tags;
CREATE POLICY "Users can view lead_tags of their organization leads"
ON public.lead_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_tags.lead_id
    AND l.organization_id = public.get_user_organization(auth.uid())
  )
);

-- Política para INSERT: usuários podem adicionar etiquetas a leads da sua organização
DROP POLICY IF EXISTS "Users can insert lead_tags for their organization leads" ON public.lead_tags;
CREATE POLICY "Users can insert lead_tags for their organization leads"
ON public.lead_tags
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_tags.lead_id
    AND l.organization_id = public.get_user_organization(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.tags t
    WHERE t.id = lead_tags.tag_id
    AND t.organization_id = public.get_user_organization(auth.uid())
  )
);

-- Política para DELETE: usuários podem remover etiquetas de leads da sua organização
DROP POLICY IF EXISTS "Users can delete lead_tags from their organization leads" ON public.lead_tags;
CREATE POLICY "Users can delete lead_tags from their organization leads"
ON public.lead_tags
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_tags.lead_id
    AND l.organization_id = public.get_user_organization(auth.uid())
  )
);



-- Migration: 20250126000000_create_google_business_tables.sql
-- Migração: Configuração de integração Google Business Profile por organização

-- Tabela para armazenar configurações de contas do Google Business Profile
CREATE TABLE IF NOT EXISTS public.google_business_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  business_account_id text,
  location_id text,
  location_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_access_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_google_business_configs_org
  ON public.google_business_configs (organization_id);

CREATE INDEX IF NOT EXISTS idx_google_business_configs_business_account
  ON public.google_business_configs (business_account_id);

-- Tabela para armazenar postagens do Google Business Profile
CREATE TABLE IF NOT EXISTS public.google_business_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_business_config_id uuid NOT NULL REFERENCES public.google_business_configs(id) ON DELETE CASCADE,
  post_type text NOT NULL CHECK (post_type IN ('UPDATE', 'EVENT', 'OFFER', 'PRODUCT')),
  summary text NOT NULL,
  description text,
  call_to_action_type text CHECK (call_to_action_type IN ('CALL', 'BOOK', 'ORDER', 'LEARN_MORE', 'SIGN_UP')),
  call_to_action_url text,
  media_urls jsonb DEFAULT '[]'::jsonb,
  scheduled_for timestamptz NOT NULL,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
  google_post_id text,
  error_message text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para google_business_posts
CREATE INDEX IF NOT EXISTS idx_google_business_posts_org
  ON public.google_business_posts (organization_id);

CREATE INDEX IF NOT EXISTS idx_google_business_posts_config
  ON public.google_business_posts (google_business_config_id);

CREATE INDEX IF NOT EXISTS idx_google_business_posts_status
  ON public.google_business_posts (status);

CREATE INDEX IF NOT EXISTS idx_google_business_posts_scheduled_for
  ON public.google_business_posts (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_google_business_posts_created_at
  ON public.google_business_posts (created_at DESC);

-- Habilitar RLS
ALTER TABLE public.google_business_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_posts ENABLE ROW LEVEL SECURITY;

-- Policies para google_business_configs
CREATE POLICY "Google Business config: members can select"
  ON public.google_business_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business config: members can insert"
  ON public.google_business_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business config: members can update"
  ON public.google_business_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business config: members can delete"
  ON public.google_business_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para google_business_posts
CREATE POLICY "Google Business posts: members can select"
  ON public.google_business_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_posts.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_posts.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business posts: members can insert"
  ON public.google_business_posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_posts.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_posts.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business posts: members can update"
  ON public.google_business_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_posts.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_posts.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Business posts: members can delete"
  ON public.google_business_posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_business_posts.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_business_posts.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_google_business_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_business_configs_updated_at
  BEFORE UPDATE ON public.google_business_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_business_configs_updated_at();

CREATE OR REPLACE FUNCTION public.update_google_business_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_business_posts_updated_at
  BEFORE UPDATE ON public.google_business_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_business_posts_updated_at();



-- Migration: 20250127000000_create_post_sale_leads.sql
-- Criar tabela de leads de pós-venda
CREATE TABLE IF NOT EXISTS public.post_sale_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  value DECIMAL(10,2),
  source TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  stage_id UUID REFERENCES public.post_sale_stages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  deleted_at TIMESTAMPTZ,
  -- Referência ao lead original do funil de vendas (se foi transferido)
  original_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES public.profiles(id)
);

-- Criar tabela de etapas do funil de pós-venda
CREATE TABLE IF NOT EXISTS public.post_sale_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_post_sale_stage_name_per_org UNIQUE(organization_id, name)
);

-- Criar tabela de atividades de pós-venda
CREATE TABLE IF NOT EXISTS public.post_sale_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de tags de pós-venda (reutiliza a tabela tags existente via lead_tags)
CREATE TABLE IF NOT EXISTS public.post_sale_lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_sale_lead_id, tag_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_org_id ON public.post_sale_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_user_id ON public.post_sale_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_phone ON public.post_sale_leads(phone);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_stage_id ON public.post_sale_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_deleted_at ON public.post_sale_leads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_post_sale_stages_org_id ON public.post_sale_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_activities_lead_id ON public.post_sale_activities(post_sale_lead_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_lead_tags_lead_id ON public.post_sale_lead_tags(post_sale_lead_id);

-- Unique index para evitar duplicatas de telefone por organização (apenas leads ativos)
CREATE UNIQUE INDEX IF NOT EXISTS ux_post_sale_leads_org_phone_active
ON public.post_sale_leads (organization_id, phone)
WHERE deleted_at IS NULL;

-- Habilitar RLS
ALTER TABLE public.post_sale_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_lead_tags ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para post_sale_leads
CREATE POLICY "Users can view post sale leads of their organization"
ON public.post_sale_leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_leads.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert post sale leads for their organization"
ON public.post_sale_leads FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_leads.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update post sale leads of their organization"
ON public.post_sale_leads FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_leads.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete post sale leads of their organization"
ON public.post_sale_leads FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_leads.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Políticas RLS para post_sale_stages
CREATE POLICY "Users can view post sale stages of their organization"
ON public.post_sale_stages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_stages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert post sale stages for their organization"
ON public.post_sale_stages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_stages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update post sale stages of their organization"
ON public.post_sale_stages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_stages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete post sale stages of their organization"
ON public.post_sale_stages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_stages.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Políticas RLS para post_sale_activities
CREATE POLICY "Users can view post sale activities of their organization"
ON public.post_sale_activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_activities.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert post sale activities for their organization"
ON public.post_sale_activities FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_activities.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Políticas RLS para post_sale_lead_tags
CREATE POLICY "Users can view post sale lead tags of their organization"
ON public.post_sale_lead_tags FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.post_sale_leads psl
    JOIN public.organization_members om ON om.organization_id = psl.organization_id
    WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert post sale lead tags for their organization"
ON public.post_sale_lead_tags FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.post_sale_leads psl
    JOIN public.organization_members om ON om.organization_id = psl.organization_id
    WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete post sale lead tags of their organization"
ON public.post_sale_lead_tags FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.post_sale_leads psl
    JOIN public.organization_members om ON om.organization_id = psl.organization_id
    WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
    AND om.user_id = auth.uid()
  )
);

-- Trigger para normalizar telefone
CREATE OR REPLACE FUNCTION public.normalize_post_sale_lead_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '\\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_post_sale_lead_phone_ins
BEFORE INSERT ON public.post_sale_leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_post_sale_lead_phone();

CREATE TRIGGER trg_normalize_post_sale_lead_phone_upd
BEFORE UPDATE OF phone ON public.post_sale_leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_post_sale_lead_phone();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_post_sale_leads_updated_at
BEFORE UPDATE ON public.post_sale_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_post_sale_stages_updated_at
BEFORE UPDATE ON public.post_sale_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar etapas padrão de pós-venda
CREATE OR REPLACE FUNCTION public.create_default_post_sale_stages(p_org_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se já existem etapas para esta organização
  IF EXISTS (SELECT 1 FROM public.post_sale_stages WHERE organization_id = p_org_id) THEN
    RETURN;
  END IF;

  -- Criar etapas padrão
  INSERT INTO public.post_sale_stages (organization_id, user_id, name, color, position)
  VALUES
    (p_org_id, p_user_id, 'Novo Cliente', '#10b981', 0),
    (p_org_id, p_user_id, 'Ativação', '#3b82f6', 1),
    (p_org_id, p_user_id, 'Suporte', '#8b5cf6', 2),
    (p_org_id, p_user_id, 'Renovação', '#f59e0b', 3),
    (p_org_id, p_user_id, 'Fidelizado', '#22c55e', 4)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

-- Adicionar ao realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_activities;



-- Migration: 20250128000000_add_excluded_from_funnel.sql
-- Adicionar campo excluded_from_funnel na tabela leads
-- Este campo marca contatos que não devem aparecer no funil de vendas (ex: funcionários)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS excluded_from_funnel BOOLEAN NOT NULL DEFAULT false;

-- Criar índice para melhor performance nas consultas filtradas
CREATE INDEX IF NOT EXISTS idx_leads_excluded_from_funnel ON public.leads(organization_id, excluded_from_funnel) 
WHERE excluded_from_funnel = true;

-- Comentário explicativo
COMMENT ON COLUMN public.leads.excluded_from_funnel IS 'Marca contatos que não devem aparecer no funil de vendas (ex: funcionários, contatos internos)';



-- Migration: 20250128000000_create_whatsapp_status_posts.sql
-- Tabela para agendamento e publicação de status do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_status_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
  error_message TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
DROP INDEX IF EXISTS idx_whatsapp_status_posts_org CASCADE;
CREATE INDEX idx_whatsapp_status_posts_org ON
CREATE INDEX idx_whatsapp_status_posts_org ON public.whatsapp_status_posts(organization_id);
DROP INDEX IF EXISTS idx_whatsapp_status_posts_instance CASCADE;
CREATE INDEX idx_whatsapp_status_posts_instance ON
CREATE INDEX idx_whatsapp_status_posts_instance ON public.whatsapp_status_posts(instance_id);
DROP INDEX IF EXISTS idx_whatsapp_status_posts_status CASCADE;
CREATE INDEX idx_whatsapp_status_posts_status ON
CREATE INDEX idx_whatsapp_status_posts_status ON public.whatsapp_status_posts(status);
DROP INDEX IF EXISTS idx_whatsapp_status_posts_scheduled CASCADE;
CREATE INDEX idx_whatsapp_status_posts_scheduled ON
CREATE INDEX idx_whatsapp_status_posts_scheduled ON public.whatsapp_status_posts(scheduled_for) 
  WHERE status = 'pending';

-- Habilitar RLS
ALTER TABLE public.whatsapp_status_posts ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view status posts of their organization"
ON public.whatsapp_status_posts
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create status posts for their organization"
ON public.whatsapp_status_posts
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update status posts of their organization"
ON public.whatsapp_status_posts
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete status posts of their organization"
ON public.whatsapp_status_posts
FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_status_posts_updated_at
BEFORE UPDATE ON public.whatsapp_status_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();





-- Migration: 20250128000001_update_create_lead_secure_excluded.sql
-- Atualizar função create_lead_secure para verificar leads excluídos do funil
-- Se um lead com o mesmo telefone já existe e está excluído do funil, não criar novamente
CREATE OR REPLACE FUNCTION public.create_lead_secure(
  p_org_id uuid,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_value numeric DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid;
  v_assigned_to text;
  v_stage_exists boolean;
  v_lead_id uuid;
  v_norm_phone text;
  v_existing_lead_id uuid;
  v_existing_excluded boolean;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
  END IF;

  -- Normalizar telefone
  v_norm_phone := regexp_replace(p_phone, '\D', '', 'g');

  -- Verificar se já existe lead com este telefone na organização
  SELECT id, excluded_from_funnel INTO v_existing_lead_id, v_existing_excluded
  FROM public.leads
  WHERE organization_id = p_org_id
    AND phone = v_norm_phone
    AND deleted_at IS NULL
  LIMIT 1;

  -- Se existe e está excluído do funil, não criar novamente
  IF v_existing_lead_id IS NOT NULL AND v_existing_excluded = true THEN
    -- Retornar o ID existente sem criar novo lead
    RETURN v_existing_lead_id;
  END IF;

  -- Se existe e não está excluído, retornar erro de duplicata
  IF v_existing_lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead com este telefone já existe na organização';
  END IF;

  -- Validar etapa se fornecida
  IF p_stage_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.pipeline_stages 
      WHERE id = p_stage_id AND organization_id = p_org_id
    ) INTO v_stage_exists;
    IF NOT v_stage_exists THEN
      RAISE EXCEPTION 'Etapa inválida para a organização';
    END IF;
  END IF;

  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    stage_id, notes, source, assigned_to, status, excluded_from_funnel
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
    p_stage_id, p_notes, p_source, COALESCE(v_assigned_to, ''), 'novo', false
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$func$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.create_lead_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_lead_secure TO anon;



-- Migration: 20250129000000_create_n8n_config.sql
-- Migração: Configuração de integração n8n por organização
-- Esta tabela armazena configurações de conexão com n8n

-- Tabela para armazenar configurações do n8n
CREATE TABLE IF NOT EXISTS public.n8n_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_url text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_connection_test timestamptz,
  connection_status text DEFAULT 'unknown', -- 'connected', 'disconnected', 'error', 'unknown'
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_n8n_configs_org
  ON public.n8n_configs (organization_id);

-- Habilitar RLS
ALTER TABLE public.n8n_configs ENABLE ROW LEVEL SECURITY;

-- Policies para n8n_configs
CREATE POLICY "n8n config: members can select"
  ON public.n8n_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = n8n_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), n8n_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "n8n config: members can insert"
  ON public.n8n_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = n8n_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), n8n_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "n8n config: members can update"
  ON public.n8n_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = n8n_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), n8n_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "n8n config: members can delete"
  ON public.n8n_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = n8n_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), n8n_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );





-- Migration: 20250130000000_create_organization_limits.sql
-- ============================================
-- MIGRAÇÃO: Limites e Funcionalidades por Organização
-- ============================================
-- Sistema robusto para gerenciar limites de leads, instâncias EVO e funcionalidades por empresa

-- Criar enum para funcionalidades do sistema
CREATE TYPE IF NOT EXISTS public.organization_feature AS ENUM (
  'leads',
  'evolution_instances',
  'broadcast',
  'scheduled_messages',
  'agents',
  'form_builder',
  'facebook_integration',
  'whatsapp_messages',
  'call_queue',
  'reports',
  'api_access'
);

-- Tabela de limites e funcionalidades por organização
CREATE TABLE IF NOT EXISTS public.organization_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Limites numéricos
  max_leads INTEGER DEFAULT NULL, -- NULL = ilimitado
  max_evolution_instances INTEGER DEFAULT NULL, -- NULL = ilimitado
  
  -- Funcionalidades habilitadas (array de enums)
  enabled_features public.organization_feature[] DEFAULT ARRAY[]::public.organization_feature[],
  
  -- Metadados
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Uma configuração por organização
  UNIQUE(organization_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_organization_limits_org ON public.organization_limits(organization_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_organization_limits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_organization_limits_updated_at
BEFORE UPDATE ON public.organization_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_organization_limits_updated_at();

-- Habilitar RLS
ALTER TABLE public.organization_limits ENABLE ROW LEVEL SECURITY;

-- Policies RLS
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all organization limits"
  ON public.organization_limits
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all organization limits"
  ON public.organization_limits
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Org owners podem ver os limites da sua organização
CREATE POLICY "Org owners can view their organization limits"
  ON public.organization_limits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_limits.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Função para obter limites de uma organização (versão inicial - será atualizada na migration de planos)
-- Esta versão inicial não suporta planos, apenas limites customizados
CREATE OR REPLACE FUNCTION public.get_organization_limits(_org_id UUID)
RETURNS TABLE (
  max_leads INTEGER,
  max_evolution_instances INTEGER,
  enabled_features public.organization_feature[],
  current_leads_count BIGINT,
  current_evolution_instances_count BIGINT,
  plan_name TEXT,
  has_custom_limits BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Versão inicial: apenas limites customizados (sem suporte a planos ainda)
  -- Será atualizada na migration 20250130000002 para incluir suporte a planos
  RETURN QUERY
  SELECT 
    COALESCE(ol.max_leads, NULL)::INTEGER as max_leads,
    COALESCE(ol.max_evolution_instances, NULL)::INTEGER as max_evolution_instances,
    COALESCE(ol.enabled_features, ARRAY[]::public.organization_feature[]) as enabled_features,
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT as current_leads_count,
    (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT as current_evolution_instances_count,
    NULL::TEXT as plan_name,
    (ol.id IS NOT NULL)::BOOLEAN as has_custom_limits
  FROM public.organization_limits ol
  WHERE ol.organization_id = _org_id
  UNION ALL
  SELECT 
    NULL::INTEGER,
    NULL::INTEGER,
    ARRAY[]::public.organization_feature[],
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT,
    NULL::TEXT,
    false::BOOLEAN
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_limits WHERE organization_id = _org_id
  )
  LIMIT 1;
END;
$$;

-- Função para verificar se pode criar lead
CREATE OR REPLACE FUNCTION public.can_create_lead(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_current_count BIGINT;
BEGIN
  -- Buscar limites
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Se não há limite definido, permitir
  IF v_limits.max_leads IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se está dentro do limite
  v_current_count := v_limits.current_leads_count;
  
  RETURN v_current_count < v_limits.max_leads;
END;
$$;

-- Função para verificar se pode criar instância EVO
CREATE OR REPLACE FUNCTION public.can_create_evolution_instance(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_current_count BIGINT;
BEGIN
  -- Verificar se a funcionalidade está habilitada
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Verificar se evolution_instances está nas funcionalidades habilitadas
  -- Se há funcionalidades definidas e evolution_instances não está entre elas, bloquear
  IF array_length(v_limits.enabled_features, 1) IS NOT NULL 
     AND array_length(v_limits.enabled_features, 1) > 0 
     AND NOT ('evolution_instances'::public.organization_feature = ANY(v_limits.enabled_features)) THEN
    RETURN FALSE;
  END IF;
  
  -- Se não há limite definido, permitir
  IF v_limits.max_evolution_instances IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se está dentro do limite
  v_current_count := v_limits.current_evolution_instances_count;
  
  RETURN v_current_count < v_limits.max_evolution_instances;
END;
$$;

-- Função para verificar se funcionalidade está habilitada
CREATE OR REPLACE FUNCTION public.has_organization_feature(
  _org_id UUID,
  _feature public.organization_feature
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
BEGIN
  -- Buscar limites
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Se não há funcionalidades definidas, permitir tudo (compatibilidade)
  IF array_length(v_limits.enabled_features, 1) IS NULL OR array_length(v_limits.enabled_features, 1) = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se a funcionalidade está no array
  RETURN _feature = ANY(v_limits.enabled_features);
END;
$$;

-- Comentários para documentação
COMMENT ON TABLE public.organization_limits IS 'Configurações de limites e funcionalidades por organização';
COMMENT ON COLUMN public.organization_limits.max_leads IS 'Número máximo de leads permitidos. NULL = ilimitado';
COMMENT ON COLUMN public.organization_limits.max_evolution_instances IS 'Número máximo de instâncias Evolution permitidas. NULL = ilimitado';
COMMENT ON COLUMN public.organization_limits.enabled_features IS 'Array de funcionalidades habilitadas para a organização';
COMMENT ON FUNCTION public.get_organization_limits(UUID) IS 'Retorna limites e contadores atuais de uma organização';
COMMENT ON FUNCTION public.can_create_lead(UUID) IS 'Verifica se a organização pode criar um novo lead';
COMMENT ON FUNCTION public.can_create_evolution_instance(UUID) IS 'Verifica se a organização pode criar uma nova instância Evolution';
COMMENT ON FUNCTION public.has_organization_feature(UUID, organization_feature) IS 'Verifica se uma funcionalidade está habilitada para a organização';



-- Migration: 20250130000001_add_limit_validations.sql
-- ============================================
-- MIGRAÇÃO: Adicionar Validações de Limites
-- ============================================
-- Atualizar funções existentes para verificar limites antes de criar leads e instâncias

-- Atualizar create_lead_secure para verificar limites
CREATE OR REPLACE FUNCTION public.create_lead_secure(
  p_org_id uuid,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_value numeric DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid;
  v_assigned_to text;
  v_stage_exists boolean;
  v_lead_id uuid;
  v_norm_phone text;
  v_existing_lead_id uuid;
  v_existing_excluded boolean;
  v_can_create boolean;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
  END IF;

  -- Verificar se pode criar lead (validação de limites)
  SELECT public.can_create_lead(p_org_id) INTO v_can_create;
  IF NOT v_can_create THEN
    RAISE EXCEPTION 'Limite de leads excedido para esta organização. Entre em contato com o administrador.';
  END IF;

  -- Normalizar telefone
  v_norm_phone := regexp_replace(p_phone, '\D', '', 'g');

  -- Verificar se já existe lead com este telefone na organização
  SELECT id, excluded_from_funnel INTO v_existing_lead_id, v_existing_excluded
  FROM public.leads
  WHERE organization_id = p_org_id
    AND phone = v_norm_phone
    AND deleted_at IS NULL
  LIMIT 1;

  -- Se existe e está excluído do funil, não criar novamente
  IF v_existing_lead_id IS NOT NULL AND v_existing_excluded = true THEN
    -- Retornar o ID existente sem criar novo lead
    RETURN v_existing_lead_id;
  END IF;

  -- Se existe e não está excluído, retornar erro de duplicata
  IF v_existing_lead_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead com este telefone já existe na organização';
  END IF;

  -- Validar etapa se fornecida
  IF p_stage_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.pipeline_stages 
      WHERE id = p_stage_id AND organization_id = p_org_id
    ) INTO v_stage_exists;
    IF NOT v_stage_exists THEN
      RAISE EXCEPTION 'Etapa inválida para a organização';
    END IF;
  END IF;

  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    stage_id, notes, source, assigned_to, status, excluded_from_funnel
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
    p_stage_id, p_notes, p_source, COALESCE(v_assigned_to, ''), 'novo', false
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$func$;

-- Trigger para validar antes de inserir instância Evolution
CREATE OR REPLACE FUNCTION public.validate_evolution_instance_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_create boolean;
  v_has_feature boolean;
BEGIN
  -- Verificar se a funcionalidade está habilitada
  SELECT public.has_organization_feature(NEW.organization_id, 'evolution_instances'::public.organization_feature)
  INTO v_has_feature;
  
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'Funcionalidade de instâncias Evolution não está habilitada para esta organização. Entre em contato com o administrador.';
  END IF;

  -- Verificar se pode criar instância (validação de limites)
  SELECT public.can_create_evolution_instance(NEW.organization_id) INTO v_can_create;
  
  IF NOT v_can_create THEN
    RAISE EXCEPTION 'Limite de instâncias Evolution excedido para esta organização. Entre em contato com o administrador.';
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger antes de inserir
DROP TRIGGER IF EXISTS trg_validate_evolution_instance_limit ON public.evolution_config;
CREATE TRIGGER trg_validate_evolution_instance_limit
BEFORE INSERT ON public.evolution_config
FOR EACH ROW
EXECUTE FUNCTION public.validate_evolution_instance_limit();

-- Comentários
COMMENT ON FUNCTION public.create_lead_secure IS 'Cria um lead de forma segura, validando limites e permissões';
COMMENT ON FUNCTION public.validate_evolution_instance_limit IS 'Valida limites antes de permitir criação de instância Evolution';





-- Migration: 20250130000002_create_plans_system.sql
-- ============================================
-- MIGRAÇÃO: Sistema de Planos
-- ============================================
-- Sistema de planos com limites pré-definidos para facilitar gestão

-- Tabela de planos
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Limites numéricos
  max_leads INTEGER DEFAULT NULL, -- NULL = ilimitado
  max_evolution_instances INTEGER DEFAULT NULL, -- NULL = ilimitado
  
  -- Funcionalidades habilitadas
  enabled_features public.organization_feature[] DEFAULT ARRAY[]::public.organization_feature[],
  
  -- Metadados
  is_active BOOLEAN DEFAULT true,
  price_monthly NUMERIC(10, 2) DEFAULT NULL, -- Preço mensal (opcional)
  price_yearly NUMERIC(10, 2) DEFAULT NULL, -- Preço anual (opcional)
  sort_order INTEGER DEFAULT 0, -- Ordem de exibição
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Adicionar plan_id na tabela organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON public.organizations(plan_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.update_plans_updated_at();

-- Habilitar RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Policies RLS para plans
-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all plans"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem gerenciar tudo
CREATE POLICY "Super admins can manage all plans"
  ON public.plans
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Org owners podem ver planos ativos
CREATE POLICY "Users can view active plans"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Função atualizada para obter limites (busca do plano ou configuração custom)
CREATE OR REPLACE FUNCTION public.get_organization_limits(_org_id UUID)
RETURNS TABLE (
  max_leads INTEGER,
  max_evolution_instances INTEGER,
  enabled_features public.organization_feature[],
  current_leads_count BIGINT,
  current_evolution_instances_count BIGINT,
  plan_name TEXT,
  has_custom_limits BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_plan_id UUID;
  v_plan RECORD;
  v_custom_limits RECORD;
BEGIN
  -- Buscar plano da organização
  SELECT plan_id INTO v_org_plan_id
  FROM public.organizations
  WHERE id = _org_id;

  -- Buscar limites customizados (se existirem)
  SELECT * INTO v_custom_limits
  FROM public.organization_limits
  WHERE organization_id = _org_id;

  -- Se há limites customizados, usar eles (prioridade)
  IF v_custom_limits IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      COALESCE(v_custom_limits.max_leads, NULL)::INTEGER,
      COALESCE(v_custom_limits.max_evolution_instances, NULL)::INTEGER,
      COALESCE(v_custom_limits.enabled_features, ARRAY[]::public.organization_feature[]),
      (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT,
      (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT,
      (SELECT name FROM public.plans WHERE id = v_org_plan_id)::TEXT,
      true::BOOLEAN;
    RETURN;
  END IF;

  -- Se não há limites customizados, buscar do plano
  IF v_org_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.plans
    WHERE id = v_org_plan_id AND is_active = true;

    IF v_plan IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        COALESCE(v_plan.max_leads, NULL)::INTEGER,
        COALESCE(v_plan.max_evolution_instances, NULL)::INTEGER,
        COALESCE(v_plan.enabled_features, ARRAY[]::public.organization_feature[]),
        (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT,
        (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT,
        v_plan.name::TEXT,
        false::BOOLEAN;
      RETURN;
    END IF;
  END IF;

  -- Se não há plano nem limites customizados, retornar ilimitado
  RETURN QUERY
  SELECT 
    NULL::INTEGER,
    NULL::INTEGER,
    ARRAY[]::public.organization_feature[],
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _org_id AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.evolution_config WHERE organization_id = _org_id)::BIGINT,
    NULL::TEXT,
    false::BOOLEAN;
END;
$$;

-- Criar planos padrão
INSERT INTO public.plans (name, description, max_leads, max_evolution_instances, enabled_features, sort_order) VALUES
  (
    'Gratuito',
    'Plano básico com funcionalidades essenciais',
    100, -- 100 leads
    1, -- 1 instância Evolution
    ARRAY[
      'leads'::public.organization_feature,
      'evolution_instances'::public.organization_feature,
      'whatsapp_messages'::public.organization_feature
    ]::public.organization_feature[],
    1
  ),
  (
    'Starter',
    'Plano para pequenas empresas',
    500, -- 500 leads
    3, -- 3 instâncias Evolution
    ARRAY[
      'leads'::public.organization_feature,
      'evolution_instances'::public.organization_feature,
      'broadcast'::public.organization_feature,
      'scheduled_messages'::public.organization_feature,
      'whatsapp_messages'::public.organization_feature,
      'call_queue'::public.organization_feature
    ]::public.organization_feature[],
    2
  ),
  (
    'Profissional',
    'Plano completo para empresas em crescimento',
    5000, -- 5000 leads
    10, -- 10 instâncias Evolution
    ARRAY[
      'leads'::public.organization_feature,
      'evolution_instances'::public.organization_feature,
      'broadcast'::public.organization_feature,
      'scheduled_messages'::public.organization_feature,
      'agents'::public.organization_feature,
      'form_builder'::public.organization_feature,
      'whatsapp_messages'::public.organization_feature,
      'call_queue'::public.organization_feature,
      'reports'::public.organization_feature
    ]::public.organization_feature[],
    3
  ),
  (
    'Enterprise',
    'Plano completo com todas as funcionalidades',
    NULL, -- Ilimitado
    NULL, -- Ilimitado
    ARRAY[
      'leads'::public.organization_feature,
      'evolution_instances'::public.organization_feature,
      'broadcast'::public.organization_feature,
      'scheduled_messages'::public.organization_feature,
      'agents'::public.organization_feature,
      'form_builder'::public.organization_feature,
      'facebook_integration'::public.organization_feature,
      'whatsapp_messages'::public.organization_feature,
      'call_queue'::public.organization_feature,
      'reports'::public.organization_feature,
      'api_access'::public.organization_feature
    ]::public.organization_feature[],
    4
  )
ON CONFLICT (name) DO NOTHING;

-- Comentários
COMMENT ON TABLE public.plans IS 'Planos com limites pré-definidos para organizações';
COMMENT ON COLUMN public.plans.max_leads IS 'Número máximo de leads permitidos. NULL = ilimitado';
COMMENT ON COLUMN public.plans.max_evolution_instances IS 'Número máximo de instâncias Evolution permitidas. NULL = ilimitado';
COMMENT ON COLUMN public.plans.enabled_features IS 'Array de funcionalidades habilitadas no plano';
COMMENT ON COLUMN public.organizations.plan_id IS 'Plano associado à organização. NULL = sem plano (ilimitado)';





-- Migration: 20250130000003_update_get_organizations_rpc.sql
-- ============================================
-- MIGRAÇÃO: Atualizar função RPC para incluir plan_id
-- ============================================

-- Atualizar função para incluir plan_id
CREATE OR REPLACE FUNCTION public.get_all_organizations_with_members()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_created_at timestamptz,
  org_plan_id uuid,
  member_user_id uuid,
  member_role text,
  member_created_at timestamptz,
  member_email text,
  member_full_name text,
  member_roles jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id as org_id,
    o.name as org_name,
    o.created_at as org_created_at,
    o.plan_id as org_plan_id,
    om.user_id as member_user_id,
    om.role as member_role,
    om.created_at as member_created_at,
    p.email as member_email,
    p.full_name as member_full_name,
    (
      SELECT jsonb_agg(jsonb_build_object('role', ur.role))
      FROM user_roles ur
      WHERE ur.user_id = om.user_id
    ) as member_roles
  FROM organizations o
  LEFT JOIN organization_members om ON om.organization_id = o.id
  LEFT JOIN profiles p ON p.id = om.user_id
  ORDER BY o.created_at DESC;
$$;





-- Migration: 20250130000004_refine_permissions_system.sql
-- ============================================
-- MIGRAÇÃO: Refinamento do Sistema de Permissões
-- ============================================
-- Integra permissões com funcionalidades do plano e melhora controle por organização

-- Função para verificar se uma permissão está relacionada a uma funcionalidade do plano
CREATE OR REPLACE FUNCTION public.permission_to_feature(_permission app_permission)
RETURNS public.organization_feature
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result public.organization_feature;
BEGIN
  -- Mapear permissões para funcionalidades do plano
  CASE _permission
    WHEN 'view_leads' THEN v_result := 'leads'::public.organization_feature;
    WHEN 'create_leads' THEN v_result := 'leads'::public.organization_feature;
    WHEN 'edit_leads' THEN v_result := 'leads'::public.organization_feature;
    WHEN 'delete_leads' THEN v_result := 'leads'::public.organization_feature;
    
    WHEN 'view_whatsapp' THEN v_result := 'whatsapp_messages'::public.organization_feature;
    WHEN 'send_whatsapp' THEN v_result := 'whatsapp_messages'::public.organization_feature;
    
    WHEN 'view_broadcast' THEN v_result := 'broadcast'::public.organization_feature;
    WHEN 'create_broadcast' THEN v_result := 'broadcast'::public.organization_feature;
    
    WHEN 'view_call_queue' THEN v_result := 'call_queue'::public.organization_feature;
    WHEN 'manage_call_queue' THEN v_result := 'call_queue'::public.organization_feature;
    
    WHEN 'view_reports' THEN v_result := 'reports'::public.organization_feature;
    
    -- Permissões que não dependem de funcionalidades específicas (sempre disponíveis)
    ELSE v_result := NULL;
  END CASE;
  
  RETURN v_result;
END;
$$;

-- Função para verificar se permissão é válida para a organização (considera plano)
CREATE OR REPLACE FUNCTION public.is_permission_allowed_for_org(
  _permission app_permission,
  _org_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature public.organization_feature;
  v_limits RECORD;
BEGIN
  -- Buscar funcionalidade relacionada à permissão
  v_feature := public.permission_to_feature(_permission);
  
  -- Se não há funcionalidade relacionada, permitir (permissões básicas sempre disponíveis)
  IF v_feature IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Buscar limites e funcionalidades da organização
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Se não há funcionalidades definidas, permitir tudo (compatibilidade)
  IF array_length(v_limits.enabled_features, 1) IS NULL OR array_length(v_limits.enabled_features, 1) = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se a funcionalidade está habilitada
  RETURN v_feature = ANY(v_limits.enabled_features);
END;
$$;

-- Função para obter permissões disponíveis para uma organização (filtradas pelo plano)
CREATE OR REPLACE FUNCTION public.get_available_permissions_for_org(_org_id UUID)
RETURNS TABLE(permission app_permission)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_permission_text TEXT;
  v_permissions_array TEXT[] := ARRAY[
    'view_leads', 'create_leads', 'edit_leads', 'delete_leads',
    'view_call_queue', 'manage_call_queue',
    'view_broadcast', 'create_broadcast',
    'view_whatsapp', 'send_whatsapp',
    'view_templates', 'manage_templates',
    'view_pipeline', 'manage_pipeline',
    'view_settings', 'manage_settings',
    'manage_users', 'view_reports'
  ];
BEGIN
  -- Buscar limites e funcionalidades da organização
  SELECT * INTO v_limits FROM public.get_organization_limits(_org_id) LIMIT 1;
  
  -- Iterar sobre todas as permissões
  FOREACH v_permission_text IN ARRAY v_permissions_array
  LOOP
    -- Se não há funcionalidades definidas, retornar todas
    IF array_length(v_limits.enabled_features, 1) IS NULL OR array_length(v_limits.enabled_features, 1) = 0 THEN
      permission := v_permission_text::app_permission;
      RETURN NEXT;
    -- Se a permissão é permitida, retornar
    ELSIF public.is_permission_allowed_for_org(v_permission_text::app_permission, _org_id) THEN
      permission := v_permission_text::app_permission;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Trigger para validar permissões ao inserir/atualizar
CREATE OR REPLACE FUNCTION public.validate_user_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_allowed BOOLEAN;
BEGIN
  -- Se organization_id é NULL, permitir (permissão global)
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se a permissão é permitida para a organização
  SELECT public.is_permission_allowed_for_org(NEW.permission, NEW.organization_id) INTO v_is_allowed;
  
  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'A permissão % não está disponível para esta organização. Verifique o plano e funcionalidades habilitadas.', NEW.permission;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_validate_user_permission ON public.user_permissions;
CREATE TRIGGER trg_validate_user_permission
BEFORE INSERT OR UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_permission();

-- Atualizar função has_org_permission para considerar funcionalidades do plano
CREATE OR REPLACE FUNCTION public.has_org_permission(
  _user_id UUID, 
  _permission app_permission,
  _org_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_permission BOOLEAN;
  v_is_allowed BOOLEAN;
BEGIN
  -- Verificar se a permissão está disponível para a organização (plano)
  SELECT public.is_permission_allowed_for_org(_permission, _org_id) INTO v_is_allowed;
  
  IF NOT v_is_allowed THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se o usuário tem a permissão
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND (organization_id = _org_id OR organization_id IS NULL)
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.permission_to_feature(app_permission) IS 'Mapeia uma permissão para sua funcionalidade relacionada no plano';
COMMENT ON FUNCTION public.is_permission_allowed_for_org(app_permission, UUID) IS 'Verifica se uma permissão está disponível para a organização baseado no plano';
COMMENT ON FUNCTION public.get_available_permissions_for_org(UUID) IS 'Retorna lista de permissões disponíveis para uma organização baseado no plano';
COMMENT ON FUNCTION public.validate_user_permission() IS 'Valida se permissão pode ser atribuída considerando funcionalidades do plano';



-- Migration: 20250130000005_add_integration_features.sql
-- ============================================
-- MIGRAÇÃO: Adicionar Funcionalidades de Integração
-- ============================================
-- Adiciona novas funcionalidades ao enum para controlar acesso às integrações

-- Função auxiliar para adicionar valor ao enum se não existir
CREATE OR REPLACE FUNCTION public.add_enum_value_if_not_exists(
  _enum_type TEXT,
  _enum_value TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Verificar se o valor já existe no enum
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = _enum_value
      AND enumtypid = (
        SELECT oid
        FROM pg_type
        WHERE typname = _enum_type
      )
  ) INTO v_exists;
  
  -- Se não existe, adicionar
  IF NOT v_exists THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE %L', _enum_type, _enum_value);
  END IF;
END;
$$;

-- Adicionar novos valores ao enum organization_feature
DO $$
BEGIN
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'calendar_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'gmail_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'payment_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'bubble_integration');
  PERFORM public.add_enum_value_if_not_exists('organization_feature', 'hubspot_integration');
  -- DESABILITADO: Chatwoot removido do projeto
  -- PERFORM public.add_enum_value_if_not_exists('organization_feature', 'chatwoot_integration');
END $$;

-- Remover função auxiliar (opcional, pode manter para uso futuro)
-- DROP FUNCTION IF EXISTS public.add_enum_value_if_not_exists(TEXT, TEXT);

-- Comentários para documentação
COMMENT ON TYPE public.organization_feature IS 'Enum de funcionalidades disponíveis para organizações. Inclui funcionalidades principais e integrações com sistemas externos.';



-- Migration: 20250131000000_create_hubspot_integration.sql
-- ============================================
-- MIGRAÇÃO: Integração HubSpot
-- ============================================

-- Tabela para armazenar configurações de integração HubSpot por organização
CREATE TABLE IF NOT EXISTS public.hubspot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  portal_id text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  sync_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_hubspot_configs_org
  ON public.hubspot_configs (organization_id);

-- Índice para buscar configurações ativas
CREATE INDEX IF NOT EXISTS idx_hubspot_configs_org_active
  ON public.hubspot_configs (organization_id, is_active)
  WHERE is_active = true;
  
-- Nota: Permitimos múltiplas configurações por organização
-- mas apenas uma deve estar ativa por vez (validação via aplicação)

-- Habilitar RLS
ALTER TABLE public.hubspot_configs ENABLE ROW LEVEL SECURITY;

-- Policies para hubspot_configs
CREATE POLICY "HubSpot config: members can select"
  ON public.hubspot_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot config: members can insert"
  ON public.hubspot_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot config: members can update"
  ON public.hubspot_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot config: members can delete"
  ON public.hubspot_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Tabela para rastrear sincronizações de contatos individuais
CREATE TABLE IF NOT EXISTS public.hubspot_contact_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hubspot_contact_id text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  sync_status text NOT NULL DEFAULT 'success', -- 'success', 'error', 'pending'
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_hubspot_contact_per_org UNIQUE(organization_id, hubspot_contact_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_hubspot_contact_sync_org
  ON public.hubspot_contact_sync (organization_id);

CREATE INDEX IF NOT EXISTS idx_hubspot_contact_sync_lead
  ON public.hubspot_contact_sync (lead_id);

CREATE INDEX IF NOT EXISTS idx_hubspot_contact_sync_status
  ON public.hubspot_contact_sync (sync_status);

CREATE INDEX IF NOT EXISTS idx_hubspot_contact_sync_hubspot_id
  ON public.hubspot_contact_sync (hubspot_contact_id);

-- Habilitar RLS
ALTER TABLE public.hubspot_contact_sync ENABLE ROW LEVEL SECURITY;

-- Policies para hubspot_contact_sync
CREATE POLICY "HubSpot sync: members can select"
  ON public.hubspot_contact_sync
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_contact_sync.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_contact_sync.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot sync: members can insert"
  ON public.hubspot_contact_sync
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_contact_sync.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_contact_sync.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "HubSpot sync: members can update"
  ON public.hubspot_contact_sync
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = hubspot_contact_sync.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), hubspot_contact_sync.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_hubspot_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_hubspot_contact_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trigger_hubspot_configs_updated_at
  BEFORE UPDATE ON public.hubspot_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hubspot_configs_updated_at();

CREATE TRIGGER trigger_hubspot_contact_sync_updated_at
  BEFORE UPDATE ON public.hubspot_contact_sync
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hubspot_contact_sync_updated_at();



-- Migration: 20250131000001_create_assistant_tables.sql
-- ============================================
-- MIGRAÇÃO: Tabelas do Assistente IA DeepSeek
-- ============================================
-- Sistema de histórico e auditoria para o assistente de IA

-- Tabela de conversas do assistente
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT, -- Título da conversa (gerado automaticamente ou pelo usuário)
  messages JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de mensagens
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de auditoria de ações do assistente
CREATE TABLE IF NOT EXISTS public.assistant_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- Tipo de ação executada (ex: 'create_lead', 'update_lead')
  function_name TEXT NOT NULL, -- Nome da função chamada
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb, -- Parâmetros passados para a função
  result JSONB, -- Resultado da execução
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT, -- Mensagem de erro se houver
  tokens_used INTEGER, -- Tokens usados na requisição (opcional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_org ON public.assistant_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user ON public.assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated ON public.assistant_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_conversation ON public.assistant_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_org ON public.assistant_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_user ON public.assistant_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_type ON public.assistant_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_created ON public.assistant_actions(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_actions ENABLE ROW LEVEL SECURITY;

-- Policies RLS para assistant_conversations
-- Usuários só podem ver conversas da sua organização E que foram criadas por eles
-- (ou são admin/pubdigital que podem ver todas)
CREATE POLICY "Users can view conversations of their organization"
ON public.assistant_conversations
FOR SELECT
USING (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create conversations for their organization"
ON public.assistant_conversations
FOR INSERT
WITH CHECK (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update conversations of their organization"
ON public.assistant_conversations
FOR UPDATE
USING (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
)
WITH CHECK (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete conversations of their organization"
ON public.assistant_conversations
FOR DELETE
USING (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Policies RLS para assistant_actions
-- Usuários só podem ver ações da sua organização E que foram executadas por eles
-- (ou são admin/pubdigital que podem ver todas)
CREATE POLICY "Users can view actions of their organization"
ON public.assistant_actions
FOR SELECT
USING (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create actions for their organization"
ON public.assistant_actions
FOR INSERT
WITH CHECK (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_assistant_conversations_updated_at
BEFORE UPDATE ON public.assistant_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.assistant_conversations IS 'Armazena o histórico de conversas do assistente IA';
COMMENT ON TABLE public.assistant_actions IS 'Auditoria de todas as ações executadas pelo assistente IA';



-- Migration: 20250131000002_create_assistant_config.sql
-- ============================================
-- MIGRAÇÃO: Configurações do Assistente IA
-- ============================================
-- Sistema para configurar diretrizes, regras e tom de voz do assistente

-- Tabela de configurações do assistente
CREATE TABLE IF NOT EXISTS public.assistant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL = configuração global (aplicada a todas as organizações)
  -- UUID = configuração específica da organização
  
  -- Diretrizes e regras
  system_prompt TEXT, -- Instruções gerais de como responder
  tone_of_voice TEXT, -- Tom de voz (ex: "profissional", "amigável", "formal")
  rules TEXT, -- Regras específicas (JSON ou texto)
  restrictions TEXT, -- O que NÃO responder ou fazer
  examples TEXT, -- Exemplos de boas respostas (JSON ou texto)
  
  -- Configurações técnicas
  temperature NUMERIC(3,2) DEFAULT 0.7, -- Temperatura do modelo (0.0 a 2.0)
  max_tokens INTEGER DEFAULT 2000, -- Máximo de tokens na resposta
  model TEXT DEFAULT 'deepseek-chat', -- Modelo a usar
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_global BOOLEAN DEFAULT false, -- Se true, aplica a todas as organizações
  
  -- Metadados
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Uma configuração por organização (ou global)
  UNIQUE(organization_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assistant_config_org ON public.assistant_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_config_global ON public.assistant_config(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_assistant_config_active ON public.assistant_config(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.assistant_config ENABLE ROW LEVEL SECURITY;

-- Policies RLS
-- Super admins podem ver todas as configurações
CREATE POLICY "Super admins can view all assistant configs"
ON public.assistant_config
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Usuários podem ver configuração da sua organização
CREATE POLICY "Users can view their organization config"
ON public.assistant_config
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR is_global = true
);

-- Super admins podem criar/atualizar configurações
CREATE POLICY "Super admins can manage all assistant configs"
ON public.assistant_config
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_assistant_config_updated_at
BEFORE UPDATE ON public.assistant_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.assistant_config IS 'Configurações de diretrizes, regras e tom de voz do assistente IA';
COMMENT ON COLUMN public.assistant_config.system_prompt IS 'Instruções gerais de como o assistente deve responder';
COMMENT ON COLUMN public.assistant_config.tone_of_voice IS 'Tom de voz desejado (profissional, amigável, formal, etc.)';
COMMENT ON COLUMN public.assistant_config.rules IS 'Regras específicas de comportamento';
COMMENT ON COLUMN public.assistant_config.restrictions IS 'O que o assistente NÃO deve fazer ou responder';
COMMENT ON COLUMN public.assistant_config.is_global IS 'Se true, esta configuração se aplica a todas as organizações';





COMMIT;

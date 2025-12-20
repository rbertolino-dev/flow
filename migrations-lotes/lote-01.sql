-- ============================================
-- Lote 1 de Migrations
-- Migrations 1 até 20
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


-- Migration: 20250101000000_add_chatwoot_create_leads_option.sql
-- DESABILITADO: Chatwoot removido do projeto
-- -- Adicionar campo para controlar criação de leads no Chatwoot
-- ALTER TABLE public.chatwoot_configs
-- ADD COLUMN IF NOT EXISTS create_leads BOOLEAN DEFAULT true;

-- -- Comentário explicativo
-- COMMENT ON COLUMN public.chatwoot_configs.create_leads IS 'Se true, cria leads no funil quando recebe mensagens. Se false, apenas processa mensagens sem criar leads.';



-- Migration: 20250101000001_create_profiles.sql
-- Migration já aplicada manualmente


-- Migration: 20250101000002_create_helper_functions.sql
-- Migration já aplicada manualmente


-- Migration: 20250101000003_create_base_tables.sql
-- Migration já aplicada


-- Migration: 20250101000004_create_app_role_type.sql
-- Criar enum para roles (necessário para outras migrations)
-- Esta migration deve ser aplicada antes de migrations que usam app_role
-- Nota: A função has_role será criada na migration que cria a tabela user_roles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;


-- Migration: 20250115000000_create_instance_health_metrics.sql
-- ============================================================================
-- TABELA DE MÉTRICAS DE SAÚDE DE INSTÂNCIAS (OTIMIZADA)
-- ============================================================================
-- Esta tabela armazena métricas agregadas por hora para reduzir custos
-- Em vez de 1 registro por mensagem, temos 1 registro por hora por instância
-- Reduz writes em ~99% comparado a abordagem não otimizada
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.instance_health_metrics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL, -- Foreign key será adicionada depois quando evolution_config existir
  hour_bucket TIMESTAMPTZ NOT NULL, -- Agrupa por hora (ex: 2025-01-15 10:00:00)
  
  -- Métricas agregadas (soma de 1 hora)
  messages_sent INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  http_200_count INTEGER DEFAULT 0,
  http_401_count INTEGER DEFAULT 0,
  http_404_count INTEGER DEFAULT 0,
  http_429_count INTEGER DEFAULT 0, -- Rate limit detectado
  http_500_count INTEGER DEFAULT 0,
  
  -- Padrões de risco
  consecutive_failures_max INTEGER DEFAULT 0, -- Máximo de falhas consecutivas no período
  avg_response_time_ms INTEGER, -- Tempo médio de resposta em ms
  
  -- Estados de conexão Baileys
  connection_state_changes INTEGER DEFAULT 0, -- Quantas vezes mudou de estado
  last_connection_state TEXT, -- Último estado conhecido ('open', 'close', 'connecting', 'qr', 'timeout')
  
  -- Últimos erros (para debug)
  last_error_message TEXT,
  last_error_code TEXT,
  
  -- Volume
  messages_per_hour INTEGER GENERATED ALWAYS AS (messages_sent + messages_failed) STORED,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Índice único para evitar duplicatas e permitir upsert eficiente
  CONSTRAINT unique_instance_hour UNIQUE(instance_id, hour_bucket)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_health_metrics_instance ON public.instance_health_metrics_hourly(instance_id, hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_hour_bucket ON public.instance_health_metrics_hourly(hour_bucket DESC);

-- RLS Policies
ALTER TABLE public.instance_health_metrics_hourly ENABLE ROW LEVEL SECURITY;

-- DESABILITADO: Policy comentada pois evolution_config ainda não existe
-- Será habilitada depois quando evolution_config for criada
-- -- Usuários podem ver métricas de suas instâncias
-- CREATE POLICY "Users can view metrics of their instances"
--   ON public.instance_health_metrics_hourly
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.evolution_config ec
--       WHERE ec.id = instance_health_metrics_hourly.instance_id
--         AND ec.organization_id IN (
--           SELECT organization_id FROM public.organization_members
--           WHERE user_id = auth.uid()
--         )
--     )
--   );

-- Edge functions podem inserir/atualizar (service role)
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
CREATE POLICY "Service role can manage metrics"
  ON public.instance_health_metrics_hourly
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at (função será criada depois)
-- CREATE TRIGGER update_instance_health_metrics_updated_at
--   BEFORE UPDATE ON public.instance_health_metrics_hourly
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.instance_health_metrics_hourly IS 'Métricas de saúde agregadas por hora para reduzir custos de storage e writes';
COMMENT ON COLUMN public.instance_health_metrics_hourly.hour_bucket IS 'Timestamp truncado para hora (ex: 2025-01-15 10:00:00)';
COMMENT ON COLUMN public.instance_health_metrics_hourly.http_429_count IS 'Contador de rate limits detectados (HTTP 429)';
COMMENT ON COLUMN public.instance_health_metrics_hourly.consecutive_failures_max IS 'Máximo de falhas consecutivas no período de 1 hora';



-- Migration: 20250115000001_create_instance_risk_score_function.sql
-- ============================================================================
-- FUNÇÃO SQL PARA CALCULAR SCORE DE RISCO (OTIMIZADA)
-- ============================================================================
-- Calcula score de risco de banimento baseado em métricas agregadas
-- Retorna tudo em 1 query (em vez de múltiplas queries)
-- Reduz custos de database reads em ~90%
-- ============================================================================

CREATE OR REPLACE FUNCTION get_instance_risk_score(
  p_instance_id UUID,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  instance_id UUID,
  risk_score INTEGER,
  error_rate DECIMAL,
  messages_sent_total BIGINT,
  messages_failed_total BIGINT,
  consecutive_failures_max INTEGER,
  rate_limits_detected INTEGER,
  connection_state_changes_total INTEGER,
  last_connection_state TEXT,
  last_error_message TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
BEGIN
  v_end_time := NOW();
  v_start_time := v_end_time - (p_hours_back || ' hours')::INTERVAL;
  
  RETURN QUERY
  WITH aggregated_metrics AS (
    SELECT 
      instance_id,
      SUM(messages_sent)::BIGINT as total_sent,
      SUM(messages_failed)::BIGINT as total_failed,
      SUM(http_429_count)::INTEGER as total_rate_limits,
      MAX(consecutive_failures_max)::INTEGER as max_consecutive_failures,
      SUM(connection_state_changes)::INTEGER as total_state_changes,
      MAX(last_connection_state) as last_state,
      MAX(last_error_message) as last_error
    FROM public.instance_health_metrics_hourly
    WHERE instance_id = p_instance_id
      AND hour_bucket >= date_trunc('hour', v_start_time)
      AND hour_bucket <= date_trunc('hour', v_end_time)
    GROUP BY instance_id
  ),
  calculated_metrics AS (
    SELECT 
      instance_id,
      total_sent,
      total_failed,
      total_rate_limits,
      max_consecutive_failures,
      total_state_changes,
      last_state,
      last_error,
      -- Calcular taxa de erro
      CASE 
        WHEN (total_sent + total_failed) > 0 
        THEN (total_failed::DECIMAL / (total_sent + total_failed) * 100)
        ELSE 0 
      END as error_rate_calc
    FROM aggregated_metrics
  )
  SELECT 
    cm.instance_id,
    -- Calcular score de risco (0-100)
    LEAST(100, 
      -- Taxa de erro (0-30 pontos)
      CASE 
        WHEN cm.error_rate_calc > 20 THEN 30
        WHEN cm.error_rate_calc > 15 THEN 20
        WHEN cm.error_rate_calc > 10 THEN 10
        ELSE 0
      END +
      -- Falhas consecutivas (0-25 pontos)
      CASE 
        WHEN cm.max_consecutive_failures >= 10 THEN 25
        WHEN cm.max_consecutive_failures >= 5 THEN 15
        ELSE 0
      END +
      -- Desconexões frequentes (0-20 pontos)
      CASE 
        WHEN cm.total_state_changes > 5 THEN 20
        WHEN cm.total_state_changes > 3 THEN 10
        ELSE 0
      END +
      -- Rate limits detectados (0-15 pontos)
      CASE 
        WHEN cm.total_rate_limits > 0 THEN 15
        ELSE 0
      END +
      -- Volume alto + erro alto (0-10 pontos)
      CASE 
        WHEN (cm.total_sent + cm.total_failed) > 100 
          AND cm.error_rate_calc > 10 THEN 10
        ELSE 0
      END
    )::INTEGER as risk_score,
    cm.error_rate_calc as error_rate,
    cm.total_sent as messages_sent_total,
    cm.total_failed as messages_failed_total,
    cm.max_consecutive_failures as consecutive_failures_max,
    cm.total_rate_limits as rate_limits_detected,
    cm.total_state_changes as connection_state_changes_total,
    cm.last_state as last_connection_state,
    cm.last_error as last_error_message,
    v_start_time as period_start,
    v_end_time as period_end
  FROM calculated_metrics cm;
  
  -- Se não houver métricas, retornar valores padrão
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      p_instance_id::UUID,
      0::INTEGER as risk_score,
      0::DECIMAL as error_rate,
      0::BIGINT as messages_sent_total,
      0::BIGINT as messages_failed_total,
      0::INTEGER as consecutive_failures_max,
      0::INTEGER as rate_limits_detected,
      0::INTEGER as connection_state_changes_total,
      NULL::TEXT as last_connection_state,
      NULL::TEXT as last_error_message,
      v_start_time as period_start,
      v_end_time as period_end;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_instance_risk_score(UUID, INTEGER) IS 
'Calcula score de risco de banimento (0-100) baseado em métricas agregadas. Retorna tudo em 1 query otimizada.';



-- Migration: 20250120000000_create_google_calendar_tables.sql
-- Migração: Configuração de integração Google Calendar por organização

-- Tabela para armazenar configurações de contas do Google Calendar
CREATE TABLE IF NOT EXISTS public.google_calendar_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_google_calendar_configs_org
  ON public.google_calendar_configs (organization_id);

-- Tabela para cache de eventos do Google Calendar
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_calendar_config_id uuid NOT NULL REFERENCES public.google_calendar_configs(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  summary text,
  description text,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  location text,
  html_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(google_calendar_config_id, google_event_id)
);

-- Índices para calendar_events
CREATE INDEX IF NOT EXISTS idx_calendar_events_org
  ON public.calendar_events (organization_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_config
  ON public.calendar_events (google_calendar_config_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_dates
  ON public.calendar_events (start_datetime, end_datetime);

-- Habilitar RLS
ALTER TABLE public.google_calendar_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Policies para google_calendar_configs
DROP POLICY IF EXISTS "Google Calendar config: members can select" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem selecionar" ON public.google_calendar_configs;
CREATE POLICY "Google Calendar config: members can select"
  ON public.google_calendar_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_calendar_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_calendar_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Calendar config: members can insert"
  ON public.google_calendar_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_calendar_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_calendar_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Google Calendar config: members can update" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem atualizar" ON public.google_calendar_configs;
CREATE POLICY "Google Calendar config: members can update"
  ON public.google_calendar_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_calendar_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_calendar_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Google Calendar config: members can delete"
  ON public.google_calendar_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = google_calendar_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), google_calendar_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para calendar_events
DROP POLICY IF EXISTS "Calendar events: members can select" ON public.calendar_events;
CREATE POLICY "Calendar events: members can select"
  ON public.calendar_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = calendar_events.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_events.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Calendar events: members can insert" ON public.calendar_events;
CREATE POLICY "Calendar events: members can insert"
  ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = calendar_events.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_events.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Calendar events: members can update"
  ON public.calendar_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = calendar_events.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_events.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Calendar events: members can delete" ON public.calendar_events;
CREATE POLICY "Calendar events: members can delete"
  ON public.calendar_events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = calendar_events.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), calendar_events.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_google_calendar_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_calendar_configs_updated_at
  BEFORE UPDATE ON public.google_calendar_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_calendar_configs_updated_at();

CREATE OR REPLACE FUNCTION public.update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_calendar_events_updated_at();



-- Migration: 20250121000000_create_gmail_configs.sql
-- Migração: Configuração de integração Gmail por organização
-- Esta tabela armazena apenas tokens OAuth, não armazena emails

-- Tabela para armazenar configurações de contas do Gmail
CREATE TABLE IF NOT EXISTS public.gmail_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_access_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar configurações por organização
CREATE INDEX IF NOT EXISTS idx_gmail_configs_org
  ON public.gmail_configs (organization_id);

-- Habilitar RLS
ALTER TABLE public.gmail_configs ENABLE ROW LEVEL SECURITY;

-- Policies para gmail_configs
CREATE POLICY "Gmail config: members can select"
  ON public.gmail_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = gmail_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can insert"
  ON public.gmail_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = gmail_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can update"
  ON public.gmail_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = gmail_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can delete"
  ON public.gmail_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = gmail_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );







-- Migration: 20250121000001_create_calendar_message_templates.sql
-- Migração: Templates de mensagem para eventos do calendário

-- Tabela para armazenar templates de mensagem específicos para agenda
CREATE TABLE IF NOT EXISTS public.calendar_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar templates por organização
CREATE INDEX IF NOT EXISTS idx_calendar_message_templates_org
  ON public.calendar_message_templates (organization_id);

-- RLS Policies
ALTER TABLE public.calendar_message_templates ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver templates da sua organização
DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.calendar_message_templates;
CREATE POLICY "Users can view templates from their organization"
  ON public.calendar_message_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Política: Usuários podem criar templates na sua organização
DROP POLICY IF EXISTS "Users can create templates in their organization" ON public.calendar_message_templates;
CREATE POLICY "Users can create templates in their organization"
  ON public.calendar_message_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Política: Usuários podem atualizar templates da sua organização
DROP POLICY IF EXISTS "Users can update templates from their organization" ON public.calendar_message_templates;
CREATE POLICY "Users can update templates from their organization"
  ON public.calendar_message_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Política: Usuários podem deletar templates da sua organização
DROP POLICY IF EXISTS "Users can delete templates from their organization" ON public.calendar_message_templates;
CREATE POLICY "Users can delete templates from their organization"
  ON public.calendar_message_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = calendar_message_templates.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Comentários
COMMENT ON TABLE public.calendar_message_templates IS 'Templates de mensagem para eventos do calendário';
COMMENT ON COLUMN public.calendar_message_templates.template IS 'Template com variáveis: {nome}, {telefone}, {data}, {hora}, {link_meet}';









-- Migration: 20250122000000_add_stage_id_to_calendar_events.sql
-- Adicionar campo stage_id (etiqueta do funil) na tabela calendar_events
-- Nota: pipeline_stages será criada em migration posterior
-- Esta migration será aplicada depois que pipeline_stages existir
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_stages') THEN
    ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para melhorar performance (apenas se coluna existir)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'stage_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_calendar_events_stage_id
      ON public.calendar_events(stage_id)
      WHERE stage_id IS NOT NULL;
  END IF;
END $$;

-- Comentário (apenas se coluna existir)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'stage_id'
  ) THEN
    COMMENT ON COLUMN public.calendar_events.stage_id IS 'Etiqueta/etapa do funil associada à reunião';
  END IF;
END $$;





-- Migration: 20250122000000_create_follow_up_templates.sql
-- Migração: Sistema de Templates de Follow-up
-- Permite criar processos padrão de abordagem para leads

-- Tabela de templates de follow-up
CREATE TABLE IF NOT EXISTS public.follow_up_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de etapas do template
CREATE TABLE IF NOT EXISTS public.follow_up_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tip TEXT, -- Dica ou exemplo para a etapa
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de follow-ups aplicados aos leads (instância do template)
CREATE TABLE IF NOT EXISTS public.lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid()
);

-- Tabela de conclusão de etapas do follow-up
CREATE TABLE IF NOT EXISTS public.lead_follow_up_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES public.lead_follow_ups(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  UNIQUE(follow_up_id, step_id) -- Garantir que cada etapa só seja marcada uma vez
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_follow_up_templates_org ON public.follow_up_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_template_steps_template ON public.follow_up_template_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_template_steps_order ON public.follow_up_template_steps(template_id, step_order);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead ON public.lead_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_template ON public.lead_follow_ups(template_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_completions_followup ON public.lead_follow_up_step_completions(follow_up_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_completions_step ON public.lead_follow_up_step_completions(step_id);

-- Habilitar RLS
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_up_step_completions ENABLE ROW LEVEL SECURITY;

-- Policies para follow_up_templates
DROP POLICY IF EXISTS "Follow-up templates: members can select" ON public.follow_up_templates;
CREATE POLICY "Follow-up templates: members can select"
  ON public.follow_up_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Follow-up templates: members can insert" ON public.follow_up_templates;
CREATE POLICY "Follow-up templates: members can insert"
  ON public.follow_up_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Follow-up templates: members can update" ON public.follow_up_templates;
CREATE POLICY "Follow-up templates: members can update"
  ON public.follow_up_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Follow-up templates: members can delete" ON public.follow_up_templates;
CREATE POLICY "Follow-up templates: members can delete"
  ON public.follow_up_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para follow_up_template_steps (herda acesso do template)
DROP POLICY IF EXISTS "Follow-up template steps: members can select" ON public.follow_up_template_steps;
CREATE POLICY "Follow-up template steps: members can select"
  ON public.follow_up_template_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Follow-up template steps: members can insert" ON public.follow_up_template_steps;
CREATE POLICY "Follow-up template steps: members can insert"
  ON public.follow_up_template_steps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up template steps: members can update"
  ON public.follow_up_template_steps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Follow-up template steps: members can delete" ON public.follow_up_template_steps;
CREATE POLICY "Follow-up template steps: members can delete"
  ON public.follow_up_template_steps
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

-- Policies para lead_follow_ups
-- Nota: Usa user_id até organization_id ser adicionado à tabela leads
DROP POLICY IF EXISTS "Lead follow-ups: members can select" ON public.lead_follow_ups;
CREATE POLICY "Lead follow-ups: members can select"
  ON public.lead_follow_ups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Lead follow-ups: members can insert" ON public.lead_follow_ups;
CREATE POLICY "Lead follow-ups: members can insert"
  ON public.lead_follow_ups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Lead follow-ups: members can update" ON public.lead_follow_ups;
CREATE POLICY "Lead follow-ups: members can update"
  ON public.lead_follow_ups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Lead follow-ups: members can delete" ON public.lead_follow_ups;
CREATE POLICY "Lead follow-ups: members can delete"
  ON public.lead_follow_ups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para lead_follow_up_step_completions
DROP POLICY IF EXISTS "Lead follow-up step completions: members can select" ON public.lead_follow_up_step_completions;
CREATE POLICY "Lead follow-up step completions: members can select"
  ON public.lead_follow_up_step_completions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Lead follow-up step completions: members can insert" ON public.lead_follow_up_step_completions;
CREATE POLICY "Lead follow-up step completions: members can insert"
  ON public.lead_follow_up_step_completions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Lead follow-up step completions: members can update" ON public.lead_follow_up_step_completions;
CREATE POLICY "Lead follow-up step completions: members can update"
  ON public.lead_follow_up_step_completions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Lead follow-up step completions: members can delete" ON public.lead_follow_up_step_completions;
CREATE POLICY "Lead follow-up step completions: members can delete"
  ON public.lead_follow_up_step_completions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

-- Comentários explicativos
COMMENT ON TABLE public.follow_up_templates IS 'Templates de processos de follow-up que podem ser aplicados aos leads';
COMMENT ON TABLE public.follow_up_template_steps IS 'Etapas individuais de um template de follow-up';
COMMENT ON TABLE public.lead_follow_ups IS 'Instâncias de templates de follow-up aplicados a leads específicos';
COMMENT ON TABLE public.lead_follow_up_step_completions IS 'Registro de conclusão de etapas individuais do follow-up de um lead';



-- Migration: 20250122000001_create_follow_up_templates.sql
-- Migração: Sistema de Templates de Follow-up
-- Permite criar processos padrão de abordagem para leads

-- Tabela de templates de follow-up
CREATE TABLE IF NOT EXISTS public.follow_up_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de etapas do template
CREATE TABLE IF NOT EXISTS public.follow_up_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tip TEXT, -- Dica ou exemplo para a etapa
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de follow-ups aplicados aos leads (instância do template)
CREATE TABLE IF NOT EXISTS public.lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid()
);

-- Tabela de conclusão de etapas do follow-up
CREATE TABLE IF NOT EXISTS public.lead_follow_up_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES public.lead_follow_ups(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  UNIQUE(follow_up_id, step_id) -- Garantir que cada etapa só seja marcada uma vez
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_follow_up_templates_org ON public.follow_up_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_template_steps_template ON public.follow_up_template_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_template_steps_order ON public.follow_up_template_steps(template_id, step_order);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead ON public.lead_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_template ON public.lead_follow_ups(template_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_completions_followup ON public.lead_follow_up_step_completions(follow_up_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_completions_step ON public.lead_follow_up_step_completions(step_id);

-- Habilitar RLS
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_up_step_completions ENABLE ROW LEVEL SECURITY;

-- Policies para follow_up_templates
DROP POLICY IF EXISTS "Follow-up templates: members can select" ON public.follow_up_templates;
CREATE POLICY "Follow-up templates: members can select"
  ON public.follow_up_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Follow-up templates: members can insert" ON public.follow_up_templates;
CREATE POLICY "Follow-up templates: members can insert"
  ON public.follow_up_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Follow-up templates: members can update"
  ON public.follow_up_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Follow-up templates: members can delete" ON public.follow_up_templates;
CREATE POLICY "Follow-up templates: members can delete"
  ON public.follow_up_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = follow_up_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), follow_up_templates.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para follow_up_template_steps (herda acesso do template)
CREATE POLICY "Follow-up template steps: members can select"
  ON public.follow_up_template_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up template steps: members can insert"
  ON public.follow_up_template_steps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up template steps: members can update"
  ON public.follow_up_template_steps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up template steps: members can delete"
  ON public.follow_up_template_steps
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE ft.id = follow_up_template_steps.template_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_templates ft
      WHERE ft.id = follow_up_template_steps.template_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

-- Policies para lead_follow_ups
-- Nota: Usa user_id até organization_id ser adicionado à tabela leads
CREATE POLICY "Lead follow-ups: members can select"
  ON public.lead_follow_ups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Lead follow-ups: members can insert"
  ON public.lead_follow_ups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Lead follow-ups: members can update"
  ON public.lead_follow_ups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Lead follow-ups: members can delete"
  ON public.lead_follow_ups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_follow_ups.lead_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

-- Policies para lead_follow_up_step_completions
CREATE POLICY "Lead follow-up step completions: members can select"
  ON public.lead_follow_up_step_completions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Lead follow-up step completions: members can insert"
  ON public.lead_follow_up_step_completions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Lead follow-up step completions: members can update"
  ON public.lead_follow_up_step_completions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Lead follow-up step completions: members can delete"
  ON public.lead_follow_up_step_completions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.lead_follow_ups lfu
      JOIN public.leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND l.user_id = auth.uid()
    )
    OR public.is_pubdigital_user(auth.uid())
  );

-- Comentários explicativos
COMMENT ON TABLE public.follow_up_templates IS 'Templates de processos de follow-up que podem ser aplicados aos leads';
COMMENT ON TABLE public.follow_up_template_steps IS 'Etapas individuais de um template de follow-up';
COMMENT ON TABLE public.lead_follow_ups IS 'Instâncias de templates de follow-up aplicados a leads específicos';
COMMENT ON TABLE public.lead_follow_up_step_completions IS 'Registro de conclusão de etapas individuais do follow-up de um lead';



-- Migration: 20250122000002_create_instance_disconnection_notifications.sql
-- Tabela para notificações de desconexão de instâncias WhatsApp
CREATE TABLE IF NOT EXISTS public.instance_disconnection_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  qr_code TEXT,
  qr_code_fetched_at TIMESTAMPTZ,
  notification_sent_at TIMESTAMPTZ,
  whatsapp_notification_sent_at TIMESTAMPTZ,
  whatsapp_notification_to TEXT, -- Telefone para onde foi enviada a notificação
  resolved_at TIMESTAMPTZ, -- Quando a instância foi reconectada
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_org ON public.instance_disconnection_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_instance ON public.instance_disconnection_notifications(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_resolved ON public.instance_disconnection_notifications(resolved_at) 
  WHERE resolved_at IS NULL;

-- Habilitar RLS
ALTER TABLE public.instance_disconnection_notifications ENABLE ROW LEVEL SECURITY;

-- Policies RLS
-- Nota: has_role pode não existir ainda, então usamos verificação condicional
CREATE POLICY "Users can view disconnection notifications of their organization"
ON public.instance_disconnection_notifications
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR (
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role')
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Service can insert disconnection notifications"
ON public.instance_disconnection_notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update disconnection notifications of their organization"
ON public.instance_disconnection_notifications
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR (
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role')
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  OR is_pubdigital_user(auth.uid())
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_instance_disconnection_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_instance_disconnection_notifications_updated_at
BEFORE UPDATE ON public.instance_disconnection_notifications
FOR EACH ROW
EXECUTE FUNCTION update_instance_disconnection_notifications_updated_at();




-- Migration: 20250122000003_add_follow_up_step_automations.sql
-- Migração: Automações para etapas de follow-up
-- Permite configurar ações automáticas quando uma etapa é concluída

-- Tabela de automações das etapas
CREATE TABLE IF NOT EXISTS public.follow_up_step_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'send_whatsapp',
    'send_whatsapp_template',
    'add_tag',
    'remove_tag',
    'move_stage',
    'add_note',
    'add_to_call_queue',
    'remove_from_call_queue',
    'update_field',
    'update_value',
    'apply_template',
    'wait_delay',
    'create_reminder'
  )),
  action_config JSONB NOT NULL, -- Configuração específica da ação
  execution_order INTEGER NOT NULL DEFAULT 1, -- Ordem de execução quando múltiplas automações
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_follow_up_step_automations_step ON public.follow_up_step_automations(step_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_step_automations_order ON public.follow_up_step_automations(step_id, execution_order);

-- Habilitar RLS
ALTER TABLE public.follow_up_step_automations ENABLE ROW LEVEL SECURITY;

-- Policies para follow_up_step_automations (herda acesso do step/template)
CREATE POLICY "Follow-up step automations: members can select"
  ON public.follow_up_step_automations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up step automations: members can insert"
  ON public.follow_up_step_automations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up step automations: members can update"
  ON public.follow_up_step_automations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

CREATE POLICY "Follow-up step automations: members can delete"
  ON public.follow_up_step_automations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      JOIN public.organization_members om ON om.organization_id = ft.organization_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.follow_up_template_steps fts
      JOIN public.follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
        AND (public.user_is_org_admin(auth.uid(), ft.organization_id) OR public.is_pubdigital_user(auth.uid()))
    )
  );

-- Comentário explicativo
COMMENT ON TABLE public.follow_up_step_automations IS 'Automações que são executadas quando uma etapa de follow-up é marcada como concluída';
COMMENT ON COLUMN public.follow_up_step_automations.action_config IS 'JSON com configuração específica da ação. Exemplos: {"message": "texto", "instance_id": "uuid"} para send_whatsapp, {"tag_id": "uuid"} para add_tag, {"stage_id": "uuid"} para move_stage';



-- Migration: 20250123000000_add_mercado_pago_config.sql
-- Migração: Configuração de integração Mercado Pago por organização

CREATE TABLE IF NOT EXISTS public.mercado_pago_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  access_token text NOT NULL,
  public_key text,
  webhook_url text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mercado_pago_configs_org
  ON public.mercado_pago_configs (organization_id);

ALTER TABLE public.mercado_pago_configs ENABLE ROW LEVEL SECURITY;

-- Apenas membros da organização podem ver/editar sua configuração Mercado Pago
CREATE POLICY "Mercado Pago config: members can select"
  ON public.mercado_pago_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can insert"
  ON public.mercado_pago_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can update"
  ON public.mercado_pago_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_mercado_pago_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mercado_pago_configs_updated_at
  BEFORE UPDATE ON public.mercado_pago_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mercado_pago_configs_updated_at();



-- Migration: 20250123000000_add_status_to_calendar_events.sql
-- Adicionar status aos eventos do calendário
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));

-- Adicionar data de conclusão
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Adicionar notas sobre a reunião
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS completion_notes text;

-- Índice para buscar eventos por status
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON public.calendar_events(status);

-- Índice para buscar eventos completados
CREATE INDEX IF NOT EXISTS idx_calendar_events_completed ON public.calendar_events(completed_at) WHERE status = 'completed';




-- Migration: 20250123000001_add_media_to_calendar_templates.sql
-- Adicionar suporte a anexos (imagens) nos templates de calendário
ALTER TABLE public.calendar_message_templates
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type text;

-- Comentários
COMMENT ON COLUMN public.calendar_message_templates.media_url IS 'URL da imagem/anexo para o template';
COMMENT ON COLUMN public.calendar_message_templates.media_type IS 'Tipo de mídia: image, document, etc.';




-- Migration: 20250123000001_add_mercado_pago_payments.sql
-- Migração: Tabela para rastreamento de pagamentos do Mercado Pago
-- Permite armazenar e gerenciar links de pagamento gerados via Mercado Pago

CREATE TABLE IF NOT EXISTS public.mercado_pago_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  
  -- Dados do Mercado Pago
  mercado_pago_preference_id text NOT NULL UNIQUE,
  mercado_pago_payment_id text, -- Preenchido quando pagamento é confirmado
  
  -- Informações do pagamento
  valor decimal(10, 2) NOT NULL,
  descricao text,
  referencia_externa text,
  
  -- Dados do comprador
  payer_name text,
  payer_email text,
  payer_phone text,
  payer_cpf_cnpj text,
  
  -- URLs e links
  payment_link text NOT NULL, -- init_point da preferência
  sandbox_init_point text, -- Para ambiente sandbox
  
  -- Status do pagamento
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'authorized', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back')),
  status_detail text,
  
  -- Dados financeiros
  valor_pago decimal(10, 2),
  data_pagamento timestamptz,
  metodo_pagamento text, -- credit_card, debit_card, ticket, pix, etc
  
  -- Auditoria
  criado_por uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_org
  ON public.mercado_pago_payments (organization_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_lead
  ON public.mercado_pago_payments (lead_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_workflow
  ON public.mercado_pago_payments (workflow_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_preference_id
  ON public.mercado_pago_payments (mercado_pago_preference_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_payment_id
  ON public.mercado_pago_payments (mercado_pago_payment_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_status
  ON public.mercado_pago_payments (status);

-- RLS
ALTER TABLE public.mercado_pago_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mercado Pago payments: members can select"
  ON public.mercado_pago_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_payments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago payments: members can insert"
  ON public.mercado_pago_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_payments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago payments: members can update"
  ON public.mercado_pago_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_payments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_mercado_pago_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mercado_pago_payments_updated_at
  BEFORE UPDATE ON public.mercado_pago_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mercado_pago_payments_updated_at();



-- Migration: 20250124000000_add_attendees_and_organizer_to_calendar_events.sql
-- Adicionar campos de convidados e organizador aos eventos
ALTER TABLE public.calendar_events
ADD COLUMN IF NOT EXISTS organizer_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attendees jsonb DEFAULT '[]'::jsonb;

-- Índice para buscar eventos por organizador
CREATE INDEX IF NOT EXISTS idx_calendar_events_organizer ON public.calendar_events(organizer_user_id);

-- Comentários
COMMENT ON COLUMN public.calendar_events.organizer_user_id IS 'Usuário responsável pela reunião';
COMMENT ON COLUMN public.calendar_events.attendees IS 'Lista de convidados em formato JSON: [{"email": "email@example.com", "displayName": "Nome"}]';




COMMIT;

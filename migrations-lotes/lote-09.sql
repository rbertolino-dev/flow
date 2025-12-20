-- ============================================
-- Lote 9 de Migrations
-- Migrations 161 até 180
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


-- Migration: 20251118000000_create_get_daily_metrics_function.sql
-- Função SQL para buscar métricas diárias de forma otimizada
-- Reduz de 120 queries (30 dias × 4 queries) para 1 query apenas
-- Garante que retorna todos os dias do intervalo, mesmo sem dados

CREATE OR REPLACE FUNCTION get_daily_metrics(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS TABLE (
  date date,
  incoming_count bigint,
  broadcast_count bigint,
  scheduled_count bigint,
  leads_count bigint
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  day_date date;
BEGIN
  -- Garantir que start_date e end_date são válidos
  IF start_date IS NULL OR end_date IS NULL THEN
    RAISE EXCEPTION 'start_date e end_date são obrigatórios';
  END IF;
  
  -- Normalizar para início do dia
  day_date := DATE(start_date);
  
  -- Gerar todos os dias do intervalo (garante que retorna todos os dias, mesmo sem dados)
  WHILE day_date <= DATE(end_date) LOOP
    RETURN QUERY
    SELECT 
      day_date as date,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM whatsapp_messages
        WHERE DATE(timestamp) = day_date
        AND direction = 'incoming'
      ), 0)::bigint as incoming_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM broadcast_queue
        WHERE DATE(sent_at) = day_date
        AND status = 'sent'
      ), 0)::bigint as broadcast_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM scheduled_messages
        WHERE DATE(sent_at) = day_date
        AND status = 'sent'
      ), 0)::bigint as scheduled_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM leads
        WHERE DATE(created_at) <= day_date
        AND deleted_at IS NULL
      ), 0)::bigint as leads_count;
    
    day_date := day_date + INTERVAL '1 day';
  END LOOP;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION get_daily_metrics(timestamp with time zone, timestamp with time zone) IS 
  'Retorna métricas diárias agregadas para reduzir queries. Retorna todos os dias do intervalo, mesmo sem dados.';



-- Migration: 20251118000001_create_get_organization_metrics_function.sql
-- Função SQL para buscar métricas de organizações de forma otimizada
-- Reduz de 80 queries (10 orgs × 8 queries) para 1 query apenas
-- Retorna métricas do mês atual e anterior para todas as organizações

CREATE OR REPLACE FUNCTION get_organization_metrics(
  current_month_start timestamp with time zone,
  current_month_end timestamp with time zone,
  previous_month_start timestamp with time zone,
  previous_month_end timestamp with time zone
)
RETURNS TABLE (
  org_id uuid,
  org_name text,
  current_incoming bigint,
  current_broadcast bigint,
  current_scheduled bigint,
  current_leads bigint,
  prev_incoming bigint,
  prev_broadcast bigint,
  prev_scheduled bigint,
  prev_leads bigint
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Validar parâmetros
  IF current_month_start IS NULL OR current_month_end IS NULL OR
     previous_month_start IS NULL OR previous_month_end IS NULL THEN
    RAISE EXCEPTION 'Todos os parâmetros de data são obrigatórios';
  END IF;

  RETURN QUERY
  SELECT 
    o.id as org_id,
    o.name as org_name,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM whatsapp_messages
      WHERE organization_id = o.id
      AND direction = 'incoming'
      AND timestamp BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_incoming,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM broadcast_queue
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_broadcast,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM scheduled_messages
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_scheduled,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM leads
      WHERE organization_id = o.id
      AND deleted_at IS NULL
    ), 0)::bigint as current_leads,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM whatsapp_messages
      WHERE organization_id = o.id
      AND direction = 'incoming'
      AND timestamp BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_incoming,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM broadcast_queue
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_broadcast,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM scheduled_messages
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_scheduled,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM leads
      WHERE organization_id = o.id
      AND deleted_at IS NULL
      AND created_at <= previous_month_end
    ), 0)::bigint as prev_leads
  FROM organizations o
  ORDER BY o.name;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION get_organization_metrics(
  timestamp with time zone, 
  timestamp with time zone, 
  timestamp with time zone, 
  timestamp with time zone
) IS 
  'Retorna métricas de todas as organizações para mês atual e anterior de forma otimizada. Reduz de 80 queries para 1 query.';



-- Migration: 20251118020000_create_agents_schema.sql
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




-- Migration: 20251118030000_add_agent_guardrails.sql
-- Adicionar campos guardrails e few_shot_examples na tabela agents
-- Esses campos são usados para melhorar a precisão e evitar erros dos agentes IA
-- CUSTO: ZERO (apenas schema, sem impacto em queries)

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS guardrails text,
  ADD COLUMN IF NOT EXISTS few_shot_examples text;

COMMENT ON COLUMN public.agents.guardrails IS 
  'Regras obrigatórias que o agente DEVE seguir sempre (ex: NUNCA invente preços, SEMPRE escale se cliente insatisfeito)';

COMMENT ON COLUMN public.agents.few_shot_examples IS 
  'Exemplos de perguntas e respostas ideais para treinar o agente (Few-Shot Learning)';



-- Migration: 20251118200823_badbeb1d-52a3-4a94-a946-6cd2d54e3f4a.sql
-- Add Evolution OpenAI bot configuration fields to agents table
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'keyword',
  ADD COLUMN IF NOT EXISTS trigger_operator TEXT DEFAULT 'contains',
  ADD COLUMN IF NOT EXISTS trigger_value TEXT,
  ADD COLUMN IF NOT EXISTS expire INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS keyword_finish TEXT DEFAULT '#SAIR',
  ADD COLUMN IF NOT EXISTS delay_message INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS unknown_message TEXT DEFAULT 'Desculpe, não entendi. Pode repetir?',
  ADD COLUMN IF NOT EXISTS listening_from_me BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stop_bot_from_me BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS keep_open BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS debounce_time INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS ignore_jids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS function_url TEXT;

COMMENT ON COLUMN public.agents.trigger_type IS 'Tipo de gatilho: keyword, all, etc.';
COMMENT ON COLUMN public.agents.trigger_operator IS 'Operador do gatilho: equals, contains, startsWith, etc.';
COMMENT ON COLUMN public.agents.trigger_value IS 'Valor do gatilho (palavra-chave)';
COMMENT ON COLUMN public.agents.expire IS 'Tempo de expiração da sessão em minutos';
COMMENT ON COLUMN public.agents.keyword_finish IS 'Palavra-chave para encerrar o bot';
COMMENT ON COLUMN public.agents.delay_message IS 'Delay entre mensagens em milissegundos';
COMMENT ON COLUMN public.agents.unknown_message IS 'Mensagem quando não entender o usuário';
COMMENT ON COLUMN public.agents.listening_from_me IS 'Se escuta mensagens enviadas pelo próprio número';
COMMENT ON COLUMN public.agents.stop_bot_from_me IS 'Se para o bot quando recebe mensagem do próprio número';
COMMENT ON COLUMN public.agents.keep_open IS 'Manter conversa aberta após resposta';
COMMENT ON COLUMN public.agents.debounce_time IS 'Tempo de debounce em segundos';
COMMENT ON COLUMN public.agents.ignore_jids IS 'Lista de JIDs para ignorar';
COMMENT ON COLUMN public.agents.function_url IS 'URL para webhook/bridge de funções';

-- Migration: 20251119020923_9f03adff-b4b8-4ff5-8a87-778a5acf5a42.sql
-- Add response_format and split_messages columns to agents table
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS response_format text,
  ADD COLUMN IF NOT EXISTS split_messages integer;

-- Add comments for documentation
COMMENT ON COLUMN public.agents.response_format IS 'Format of the response: text or json';
COMMENT ON COLUMN public.agents.split_messages IS 'Maximum number of characters per message when splitting';

-- Migration: 20251120000000_add_assigned_to_user_id_call_queue.sql
-- Adicionar campo assigned_to_user_id na tabela call_queue para atribuir leads a usuários
ALTER TABLE public.call_queue 
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Criar índice para melhor performance nas consultas filtradas por usuário
CREATE INDEX IF NOT EXISTS idx_call_queue_assigned_to_user_id ON public.call_queue(assigned_to_user_id);

-- Comentário explicativo
COMMENT ON COLUMN public.call_queue.assigned_to_user_id IS 'Usuário responsável por esta ligação na fila de elegibilidade';



-- Migration: 20251120233908_85a29cd1-4dd7-40c5-b069-bb0516d495c2.sql
-- ============================================
-- MIGRAÇÃO: Tabelas de Janelas de Horário e Grupos de Instâncias
-- ============================================

-- Tabela para janelas de horário de envio por organização
CREATE TABLE IF NOT EXISTS public.broadcast_time_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Horários de segunda a sexta
  monday_start TIME,
  monday_end TIME,
  tuesday_start TIME,
  tuesday_end TIME,
  wednesday_start TIME,
  wednesday_end TIME,
  thursday_start TIME,
  thursday_end TIME,
  friday_start TIME,
  friday_end TIME,
  -- Horários de sábado
  saturday_start TIME,
  saturday_end TIME,
  -- Horários de domingo
  sunday_start TIME,
  sunday_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_broadcast_time_windows_org ON public.broadcast_time_windows(organization_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_time_windows_enabled ON public.broadcast_time_windows(organization_id, enabled) WHERE enabled = true;

-- Habilitar RLS
ALTER TABLE public.broadcast_time_windows ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Organizations can view their time windows"
ON public.broadcast_time_windows FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can create time windows"
ON public.broadcast_time_windows FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can update their time windows"
ON public.broadcast_time_windows FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can delete their time windows"
ON public.broadcast_time_windows FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_broadcast_time_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_broadcast_time_windows_updated_at
BEFORE UPDATE ON public.broadcast_time_windows
FOR EACH ROW
EXECUTE FUNCTION update_broadcast_time_windows_updated_at();

-- ============================================
-- Tabela de Grupos de Instâncias
-- ============================================

CREATE TABLE IF NOT EXISTS public.instance_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instance_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_instance_groups_org ON public.instance_groups(organization_id);

-- Habilitar RLS
ALTER TABLE public.instance_groups ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view instance groups of their organization"
ON public.instance_groups
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create instance groups for their organization"
ON public.instance_groups
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update instance groups of their organization"
ON public.instance_groups
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete instance groups of their organization"
ON public.instance_groups
FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_instance_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_instance_groups_updated_at
BEFORE UPDATE ON public.instance_groups
FOR EACH ROW
EXECUTE FUNCTION update_instance_groups_updated_at();

-- Migration: 20251121000000_create_broadcast_time_windows.sql
-- Tabela para janelas de horário de envio por organização
CREATE TABLE IF NOT EXISTS public.broadcast_time_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Horários de segunda a sexta
  monday_start TIME,
  monday_end TIME,
  tuesday_start TIME,
  tuesday_end TIME,
  wednesday_start TIME,
  wednesday_end TIME,
  thursday_start TIME,
  thursday_end TIME,
  friday_start TIME,
  friday_end TIME,
  -- Horários de sábado
  saturday_start TIME,
  saturday_end TIME,
  -- Horários de domingo
  sunday_start TIME,
  sunday_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Índices para performance
DROP INDEX IF EXISTS idx_broadcast_time_windows_org CASCADE;
CREATE INDEX idx_broadcast_time_windows_org ON
CREATE INDEX idx_broadcast_time_windows_org ON public.broadcast_time_windows(organization_id);
DROP INDEX IF EXISTS idx_broadcast_time_windows_enabled CASCADE;
CREATE INDEX idx_broadcast_time_windows_enabled ON
CREATE INDEX idx_broadcast_time_windows_enabled ON public.broadcast_time_windows(organization_id, enabled);

-- Habilitar RLS
ALTER TABLE public.broadcast_time_windows ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view time windows of their organization"
ON public.broadcast_time_windows
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create time windows for their organization"
ON public.broadcast_time_windows
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update time windows of their organization"
ON public.broadcast_time_windows
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete time windows of their organization"
ON public.broadcast_time_windows
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_broadcast_time_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_broadcast_time_windows_updated_at
BEFORE UPDATE ON public.broadcast_time_windows
FOR EACH ROW
EXECUTE FUNCTION update_broadcast_time_windows_updated_at();

-- Função para verificar se um horário está dentro da janela permitida
CREATE OR REPLACE FUNCTION is_time_in_window(
  _org_id UUID,
  _check_time TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window RECORD;
  _day_of_week INTEGER;
  _time_only TIME;
  _start_time TIME;
  _end_time TIME;
BEGIN
  -- Se não há janela configurada, permite (comportamento padrão)
  SELECT * INTO _window
  FROM broadcast_time_windows
  WHERE organization_id = _org_id
    AND enabled = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN true; -- Sem janela = permite sempre
  END IF;

  -- Obter dia da semana (0 = domingo, 1 = segunda, ..., 6 = sábado)
  _day_of_week := EXTRACT(DOW FROM _check_time);
  _time_only := _check_time::TIME;

  -- Determinar horários de início e fim baseado no dia
  CASE _day_of_week
    WHEN 1 THEN -- Segunda
      _start_time := _window.monday_start;
      _end_time := _window.monday_end;
    WHEN 2 THEN -- Terça
      _start_time := _window.tuesday_start;
      _end_time := _window.tuesday_end;
    WHEN 3 THEN -- Quarta
      _start_time := _window.wednesday_start;
      _end_time := _window.wednesday_end;
    WHEN 4 THEN -- Quinta
      _start_time := _window.thursday_start;
      _end_time := _window.thursday_end;
    WHEN 5 THEN -- Sexta
      _start_time := _window.friday_start;
      _end_time := _window.friday_end;
    WHEN 6 THEN -- Sábado
      _start_time := _window.saturday_start;
      _end_time := _window.saturday_end;
    WHEN 0 THEN -- Domingo
      _start_time := _window.sunday_start;
      _end_time := _window.sunday_end;
  END CASE;

  -- Se não há horário configurado para o dia, não permite
  IF _start_time IS NULL OR _end_time IS NULL THEN
    RETURN false;
  END IF;

  -- Verificar se está dentro do horário
  IF _start_time <= _end_time THEN
    -- Horário normal (ex: 09:00 - 18:00)
    RETURN _time_only >= _start_time AND _time_only <= _end_time;
  ELSE
    -- Horário que cruza meia-noite (ex: 22:00 - 02:00)
    RETURN _time_only >= _start_time OR _time_only <= _end_time;
  END IF;
END;
$$;



-- Migration: 20251121000001_create_instance_groups.sql
-- Tabela para grupos de instâncias WhatsApp
CREATE TABLE IF NOT EXISTS public.instance_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instance_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Índices para performance
DROP INDEX IF EXISTS idx_instance_groups_org CASCADE;
CREATE INDEX idx_instance_groups_org ON
CREATE INDEX idx_instance_groups_org ON public.instance_groups(organization_id);

-- Habilitar RLS
ALTER TABLE public.instance_groups ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view instance groups of their organization"
ON public.instance_groups
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create instance groups for their organization"
ON public.instance_groups
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update instance groups of their organization"
ON public.instance_groups
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete instance groups of their organization"
ON public.instance_groups
FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_instance_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_instance_groups_updated_at
BEFORE UPDATE ON public.instance_groups
FOR EACH ROW
EXECUTE FUNCTION update_instance_groups_updated_at();



-- Migration: 20251121014635_8912b279-d7ab-408d-b8bd-852cd63db4a1.sql
-- Create table for Bubble.io configurations
CREATE TABLE IF NOT EXISTS public.bubble_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.bubble_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's bubble config"
  ON public.bubble_configs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert bubble config for their organization"
  ON public.bubble_configs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's bubble config"
  ON public.bubble_configs FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organization's bubble config"
  ON public.bubble_configs FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Create index
DROP INDEX IF EXISTS idx_bubble_configs_organization_id CASCADE;
CREATE INDEX idx_bubble_configs_organization_id ON
CREATE INDEX idx_bubble_configs_organization_id ON public.bubble_configs(organization_id);

-- Create updated_at trigger
CREATE TRIGGER update_bubble_configs_updated_at
  BEFORE UPDATE ON public.bubble_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for storing Bubble query history (to control usage)
CREATE TABLE IF NOT EXISTS public.bubble_query_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  query_type TEXT NOT NULL,
  query_params JSONB,
  response_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bubble_query_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's query history"
  ON public.bubble_query_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert query history for their organization"
  ON public.bubble_query_history FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Create index
DROP INDEX IF EXISTS idx_bubble_query_history_organization_id CASCADE;
CREATE INDEX idx_bubble_query_history_organization_id ON
CREATE INDEX idx_bubble_query_history_organization_id ON public.bubble_query_history(organization_id);
DROP INDEX IF EXISTS idx_bubble_query_history_created_at CASCADE;
CREATE INDEX idx_bubble_query_history_created_at ON
CREATE INDEX idx_bubble_query_history_created_at ON public.bubble_query_history(created_at DESC);

-- Migration: 20251123155416_d80b4739-91ad-4a1d-ba73-de48e32b6e8f.sql
-- DESABILITADO: Chatwoot removido do projeto
-- Esta migration foi desabilitada pois o Chatwoot não será mais usado
-- 
-- -- Tabela de configuração do Chatwoot por organização
-- CREATE TABLE IF NOT EXISTS public.chatwoot_configs (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
--   enabled BOOLEAN DEFAULT false,
--   chatwoot_base_url TEXT NOT NULL DEFAULT 'https://chat.atendimentoagilize.com',
--   chatwoot_account_id INTEGER NOT NULL,
--   chatwoot_api_access_token TEXT NOT NULL,
--   default_inbox_id INTEGER,
--   default_inbox_identifier TEXT,
--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now(),
--   UNIQUE(organization_id)
-- );
-- 
-- -- Index para busca rápida por organização
DROP INDEX IF EXISTS idx_chatwoot_configs_org CASCADE;
CREATE INDEX idx_chatwoot_configs_org ON
-- CREATE INDEX IF NOT EXISTS idx_chatwoot_configs_org ON public.chatwoot_configs(organization_id);
-- 
-- -- RLS Policies
-- ALTER TABLE public.chatwoot_configs ENABLE ROW LEVEL SECURITY;
-- 
-- -- Usuários podem ver configs da própria organização
-- CREATE POLICY "Users can view their org chatwoot config"
--   ON public.chatwoot_configs FOR SELECT
--   USING (
--     public.user_belongs_to_org(auth.uid(), organization_id)
--     OR public.has_role(auth.uid(), 'admin'::app_role)
--     OR public.is_pubdigital_user(auth.uid())
--   );
-- 
-- -- Usuários podem inserir configs da própria organização
-- CREATE POLICY "Users can insert their org chatwoot config"
--   ON public.chatwoot_configs FOR INSERT
--   WITH CHECK (
--     public.user_belongs_to_org(auth.uid(), organization_id)
--     OR public.has_role(auth.uid(), 'admin'::app_role)
--     OR public.is_pubdigital_user(auth.uid())
--   );
-- 
-- -- Usuários podem atualizar configs da própria organização
-- CREATE POLICY "Users can update their org chatwoot config"
--   ON public.chatwoot_configs FOR UPDATE
--   USING (
--     public.user_belongs_to_org(auth.uid(), organization_id)
--     OR public.has_role(auth.uid(), 'admin'::app_role)
--     OR public.is_pubdigital_user(auth.uid())
--   );
-- 
-- -- Usuários podem deletar configs da própria organização
-- CREATE POLICY "Users can delete their org chatwoot config"
--   ON public.chatwoot_configs FOR DELETE
--   USING (
--     public.user_belongs_to_org(auth.uid(), organization_id)
--     OR public.has_role(auth.uid(), 'admin'::app_role)
--     OR public.is_pubdigital_user(auth.uid())
--   );
-- 
-- -- Trigger para atualizar updated_at
-- CREATE OR REPLACE FUNCTION public.update_chatwoot_configs_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = now();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- CREATE TRIGGER update_chatwoot_configs_updated_at
--   BEFORE UPDATE ON public.chatwoot_configs
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_chatwoot_configs_updated_at();


-- Migration: 20251124153251_11ba3785-2ec6-4808-a654-6fe76e3501c8.sql
-- ============================================
-- MIGRAÇÃO: Integrações Gmail e Mercado Pago
-- ============================================

-- GMAIL CONFIGS
CREATE TABLE IF NOT EXISTS public.gmail_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_access_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_configs_org_account
  ON public.gmail_configs (organization_id, account_name);

ALTER TABLE public.gmail_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gmail config: members can select"
  ON public.gmail_configs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = gmail_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can insert"
  ON public.gmail_configs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = gmail_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can update"
  ON public.gmail_configs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = gmail_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Gmail config: members can delete"
  ON public.gmail_configs FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = gmail_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), gmail_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.update_gmail_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gmail_configs_updated_at
  BEFORE UPDATE ON public.gmail_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gmail_configs_updated_at();

-- MERCADO PAGO CONFIGS
CREATE TABLE IF NOT EXISTS public.mercado_pago_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  access_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mercado_pago_configs_org
  ON public.mercado_pago_configs (organization_id);

ALTER TABLE public.mercado_pago_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mercado Pago config: members can select"
  ON public.mercado_pago_configs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can insert"
  ON public.mercado_pago_configs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can update"
  ON public.mercado_pago_configs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago config: members can delete"
  ON public.mercado_pago_configs FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_configs.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_configs.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- MERCADO PAGO PAYMENTS
CREATE TABLE IF NOT EXISTS public.mercado_pago_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  mercado_pago_preference_id text NOT NULL,
  valor numeric NOT NULL,
  payment_link text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_org
  ON public.mercado_pago_payments (organization_id);

CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_lead
  ON public.mercado_pago_payments (lead_id);

ALTER TABLE public.mercado_pago_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mercado Pago payments: members can select"
  ON public.mercado_pago_payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_payments.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago payments: members can insert"
  ON public.mercado_pago_payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_payments.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago payments: members can update"
  ON public.mercado_pago_payments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = mercado_pago_payments.organization_id AND om.user_id = auth.uid())
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- TRIGGERS
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

CREATE OR REPLACE FUNCTION public.update_mercado_pago_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mercado_pago_payments_updated_at
  BEFORE UPDATE ON public.mercado_pago_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mercado_pago_payments_updated_at();


-- Migration: 20251124171722_21f754e2-ebf6-48ea-8772-c39ae1d1f32e.sql
-- Criar tabela de templates de follow-up
CREATE TABLE IF NOT EXISTS public.follow_up_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_template_name_per_org UNIQUE(organization_id, name)
);

-- Criar tabela de etapas de template
CREATE TABLE IF NOT EXISTS public.follow_up_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_step_order_per_template UNIQUE(template_id, step_order)
);

-- Criar tabela de automações de etapa
CREATE TABLE IF NOT EXISTS public.follow_up_step_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('send_whatsapp', 'add_tag', 'move_stage', 'add_note', 'add_to_call_queue', 'update_field')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de follow-ups aplicados a leads
CREATE TABLE IF NOT EXISTS public.lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.follow_up_templates(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Criar tabela de conclusões de etapas
CREATE TABLE IF NOT EXISTS public.lead_follow_up_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id UUID NOT NULL REFERENCES public.lead_follow_ups(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.follow_up_template_steps(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID NOT NULL REFERENCES auth.users(id),
  CONSTRAINT unique_completion_per_step UNIQUE(follow_up_id, step_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_follow_up_templates_org ON public.follow_up_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_template_steps_template ON public.follow_up_template_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_step_automations_step ON public.follow_up_step_automations(step_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead ON public.lead_follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_template ON public.lead_follow_ups(template_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_completions_followup ON public.lead_follow_up_step_completions(follow_up_id);

-- Trigger para updated_at em follow_up_templates
CREATE OR REPLACE FUNCTION update_follow_up_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_up_templates_updated_at
  BEFORE UPDATE ON public.follow_up_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_up_templates_updated_at();

-- RLS Policies para follow_up_templates
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates from their org"
  ON public.follow_up_templates FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can create templates in their org"
  ON public.follow_up_templates FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update templates in their org"
  ON public.follow_up_templates FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete templates in their org"
  ON public.follow_up_templates FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()));

-- RLS Policies para follow_up_template_steps
ALTER TABLE public.follow_up_template_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view steps from their org templates"
  ON public.follow_up_template_steps FOR SELECT
  USING (template_id IN (
    SELECT id FROM public.follow_up_templates 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can create steps in their org templates"
  ON public.follow_up_template_steps FOR INSERT
  WITH CHECK (template_id IN (
    SELECT id FROM public.follow_up_templates 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can update steps in their org templates"
  ON public.follow_up_template_steps FOR UPDATE
  USING (template_id IN (
    SELECT id FROM public.follow_up_templates 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can delete steps in their org templates"
  ON public.follow_up_template_steps FOR DELETE
  USING (template_id IN (
    SELECT id FROM public.follow_up_templates 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

-- RLS Policies para follow_up_step_automations
ALTER TABLE public.follow_up_step_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automations from their org"
  ON public.follow_up_step_automations FOR SELECT
  USING (step_id IN (
    SELECT s.id FROM public.follow_up_template_steps s
    JOIN public.follow_up_templates t ON t.id = s.template_id
    WHERE t.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can create automations in their org"
  ON public.follow_up_step_automations FOR INSERT
  WITH CHECK (step_id IN (
    SELECT s.id FROM public.follow_up_template_steps s
    JOIN public.follow_up_templates t ON t.id = s.template_id
    WHERE t.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can update automations in their org"
  ON public.follow_up_step_automations FOR UPDATE
  USING (step_id IN (
    SELECT s.id FROM public.follow_up_template_steps s
    JOIN public.follow_up_templates t ON t.id = s.template_id
    WHERE t.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can delete automations in their org"
  ON public.follow_up_step_automations FOR DELETE
  USING (step_id IN (
    SELECT s.id FROM public.follow_up_template_steps s
    JOIN public.follow_up_templates t ON t.id = s.template_id
    WHERE t.organization_id = get_user_organization(auth.uid())
  ));

-- RLS Policies para lead_follow_ups
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view follow-ups from their org leads"
  ON public.lead_follow_ups FOR SELECT
  USING (lead_id IN (
    SELECT id FROM public.leads 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can create follow-ups for their org leads"
  ON public.lead_follow_ups FOR INSERT
  WITH CHECK (lead_id IN (
    SELECT id FROM public.leads 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can update follow-ups from their org leads"
  ON public.lead_follow_ups FOR UPDATE
  USING (lead_id IN (
    SELECT id FROM public.leads 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can delete follow-ups from their org leads"
  ON public.lead_follow_ups FOR DELETE
  USING (lead_id IN (
    SELECT id FROM public.leads 
    WHERE organization_id = get_user_organization(auth.uid())
  ));

-- RLS Policies para lead_follow_up_step_completions
ALTER TABLE public.lead_follow_up_step_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view completions from their org"
  ON public.lead_follow_up_step_completions FOR SELECT
  USING (follow_up_id IN (
    SELECT fu.id FROM public.lead_follow_ups fu
    JOIN public.leads l ON l.id = fu.lead_id
    WHERE l.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can create completions in their org"
  ON public.lead_follow_up_step_completions FOR INSERT
  WITH CHECK (follow_up_id IN (
    SELECT fu.id FROM public.lead_follow_ups fu
    JOIN public.leads l ON l.id = fu.lead_id
    WHERE l.organization_id = get_user_organization(auth.uid())
  ));

CREATE POLICY "Users can delete completions in their org"
  ON public.lead_follow_up_step_completions FOR DELETE
  USING (follow_up_id IN (
    SELECT fu.id FROM public.lead_follow_ups fu
    JOIN public.leads l ON l.id = fu.lead_id
    WHERE l.organization_id = get_user_organization(auth.uid())
  ));

-- Migration: 20251124172902_e8a860a4-122e-4544-8aa1-b42a2bb5419c.sql
-- Fix RLS policies for follow_up_templates to use security definer functions

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view templates from their organization" ON follow_up_templates;
DROP POLICY IF EXISTS "Users can create templates in their organization" ON follow_up_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON follow_up_templates;
DROP POLICY IF EXISTS "Users can delete templates in their organization" ON follow_up_templates;

-- Create new policies using security definer functions
CREATE POLICY "Users can view templates from their organization"
  ON follow_up_templates FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create templates in their organization"
  ON follow_up_templates FOR INSERT
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update templates in their organization"
  ON follow_up_templates FOR UPDATE
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete templates in their organization"
  ON follow_up_templates FOR DELETE
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Fix RLS policies for follow_up_template_steps
DROP POLICY IF EXISTS "Users can view steps from their templates" ON follow_up_template_steps;
DROP POLICY IF EXISTS "Users can create steps in their templates" ON follow_up_template_steps;
DROP POLICY IF EXISTS "Users can update steps in their templates" ON follow_up_template_steps;
DROP POLICY IF EXISTS "Users can delete steps from their templates" ON follow_up_template_steps;

CREATE POLICY "Users can view steps from their templates"
  ON follow_up_template_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_templates
      WHERE id = follow_up_template_steps.template_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can create steps in their templates"
  ON follow_up_template_steps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM follow_up_templates
      WHERE id = follow_up_template_steps.template_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can update steps in their templates"
  ON follow_up_template_steps FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_templates
      WHERE id = follow_up_template_steps.template_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can delete steps from their templates"
  ON follow_up_template_steps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_templates
      WHERE id = follow_up_template_steps.template_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

-- Fix RLS policies for follow_up_step_automations
DROP POLICY IF EXISTS "Users can view automations from their steps" ON follow_up_step_automations;
DROP POLICY IF EXISTS "Users can create automations in their steps" ON follow_up_step_automations;
DROP POLICY IF EXISTS "Users can update automations in their steps" ON follow_up_step_automations;
DROP POLICY IF EXISTS "Users can delete automations from their steps" ON follow_up_step_automations;

CREATE POLICY "Users can view automations from their steps"
  ON follow_up_step_automations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_template_steps fts
      JOIN follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
      AND public.user_belongs_to_org(auth.uid(), ft.organization_id)
    )
  );

CREATE POLICY "Users can create automations in their steps"
  ON follow_up_step_automations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM follow_up_template_steps fts
      JOIN follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
      AND public.user_belongs_to_org(auth.uid(), ft.organization_id)
    )
  );

CREATE POLICY "Users can update automations in their steps"
  ON follow_up_step_automations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_template_steps fts
      JOIN follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
      AND public.user_belongs_to_org(auth.uid(), ft.organization_id)
    )
  );

CREATE POLICY "Users can delete automations from their steps"
  ON follow_up_step_automations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_template_steps fts
      JOIN follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
      AND public.user_belongs_to_org(auth.uid(), ft.organization_id)
    )
  );

-- Fix RLS policies for lead_follow_ups
DROP POLICY IF EXISTS "Users can view follow-ups from their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can create follow-ups in their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can update follow-ups in their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can delete follow-ups from their leads" ON lead_follow_ups;

CREATE POLICY "Users can view follow-ups from their leads"
  ON lead_follow_ups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can create follow-ups in their leads"
  ON lead_follow_ups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can update follow-ups in their leads"
  ON lead_follow_ups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can delete follow-ups from their leads"
  ON lead_follow_ups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

-- Fix RLS policies for lead_follow_up_step_completions
DROP POLICY IF EXISTS "Users can view step completions from their follow-ups" ON lead_follow_up_step_completions;
DROP POLICY IF EXISTS "Users can create step completions in their follow-ups" ON lead_follow_up_step_completions;
DROP POLICY IF EXISTS "Users can delete step completions from their follow-ups" ON lead_follow_up_step_completions;

CREATE POLICY "Users can view step completions from their follow-ups"
  ON lead_follow_up_step_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), l.organization_id)
    )
  );

CREATE POLICY "Users can create step completions in their follow-ups"
  ON lead_follow_up_step_completions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), l.organization_id)
    )
  );

CREATE POLICY "Users can delete step completions from their follow-ups"
  ON lead_follow_up_step_completions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), l.organization_id)
    )
  );

-- Migration: 20251125021031_70af38b0-7b06-4bf4-8a25-d00c97b08b48.sql
-- ============================================
-- MIGRAÇÃO: Tabelas calendar_message_templates e form_builders
-- ============================================

-- Tabela de templates de mensagem para calendário
CREATE TABLE IF NOT EXISTS public.calendar_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_calendar_message_templates_org 
  ON public.calendar_message_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_message_templates_active 
  ON public.calendar_message_templates(organization_id, is_active);

-- RLS
ALTER TABLE public.calendar_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org templates"
  ON public.calendar_message_templates FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert their org templates"
  ON public.calendar_message_templates FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update their org templates"
  ON public.calendar_message_templates FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete their org templates"
  ON public.calendar_message_templates FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_calendar_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calendar_message_templates_updated_at
  BEFORE UPDATE ON public.calendar_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_message_templates_updated_at();

-- Tabela de construtores de formulário
CREATE TABLE IF NOT EXISTS public.form_builders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  success_message TEXT NOT NULL DEFAULT 'Obrigado! Seus dados foram enviados com sucesso.',
  redirect_url TEXT,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_form_builders_org 
  ON public.form_builders(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_builders_active 
  ON public.form_builders(organization_id, is_active);

-- RLS
ALTER TABLE public.form_builders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org forms"
  ON public.form_builders FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert their org forms"
  ON public.form_builders FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update their org forms"
  ON public.form_builders FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete their org forms"
  ON public.form_builders FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_form_builders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_form_builders_updated_at
  BEFORE UPDATE ON public.form_builders
  FOR EACH ROW
  EXECUTE FUNCTION update_form_builders_updated_at();

-- Migration: 20251125021421_28f4cdff-9b38-4bc6-b03a-c8fdf38c2573.sql
-- ============================================
-- MIGRAÇÃO: Tabelas automation_flows e flow_executions
-- ============================================

-- Tabela de fluxos de automação
CREATE TABLE IF NOT EXISTS public.automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  flow_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_automation_flows_org 
  ON public.automation_flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_status 
  ON public.automation_flows(organization_id, status);

-- RLS
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org flows"
  ON public.automation_flows FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert their org flows"
  ON public.automation_flows FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update their org flows"
  ON public.automation_flows FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete their org flows"
  ON public.automation_flows FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_automation_flows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_automation_flows_updated_at
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_automation_flows_updated_at();

-- Tabela de execuções de fluxos
CREATE TABLE IF NOT EXISTS public.flow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_node_id TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'waiting', 'completed', 'paused', 'error')),
  execution_data JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow 
  ON public.flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_lead 
  ON public.flow_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_org 
  ON public.flow_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_status 
  ON public.flow_executions(status);
CREATE INDEX IF NOT EXISTS idx_flow_executions_next 
  ON public.flow_executions(next_execution_at) 
  WHERE status = 'waiting' AND next_execution_at IS NOT NULL;

-- RLS
ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org flow executions"
  ON public.flow_executions FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert their org flow executions"
  ON public.flow_executions FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update their org flow executions"
  ON public.flow_executions FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete their org flow executions"
  ON public.flow_executions FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_flow_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_flow_executions_updated_at
  BEFORE UPDATE ON public.flow_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_flow_executions_updated_at();

-- Migration: 20251125143434_9e7ed58a-b1a4-488b-9afe-b0087ea8d0b3.sql
-- Drop trigger existente se houver
DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON public.scheduled_messages;

-- Criar ou substituir função do trigger
CREATE OR REPLACE FUNCTION public.update_scheduled_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scheduled_messages_updated_at();

-- Migration: 20251125201446_5be86cf8-8ca1-4c5d-8bf0-d946901a18cc.sql
-- Criar tabela facebook_configs para gerenciar integrações Facebook/Instagram
CREATE TABLE IF NOT EXISTS public.facebook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT,
  instagram_account_id TEXT,
  instagram_username TEXT,
  instagram_access_token TEXT,
  enabled BOOLEAN DEFAULT true,
  messenger_enabled BOOLEAN DEFAULT true,
  instagram_enabled BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, page_id)
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_facebook_configs_organization ON public.facebook_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_facebook_configs_page_id ON public.facebook_configs(page_id);
CREATE INDEX IF NOT EXISTS idx_facebook_configs_instagram_id ON public.facebook_configs(instagram_account_id);

-- RLS Policies
ALTER TABLE public.facebook_configs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver configs da sua organização
CREATE POLICY "Users can view facebook configs from their organization"
  ON public.facebook_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = facebook_configs.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Administradores podem inserir configs
CREATE POLICY "Admins can insert facebook configs"
  ON public.facebook_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = facebook_configs.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Administradores podem atualizar configs
CREATE POLICY "Admins can update facebook configs"
  ON public.facebook_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = facebook_configs.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Administradores podem deletar configs
CREATE POLICY "Admins can delete facebook configs"
  ON public.facebook_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = facebook_configs.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
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

-- Migration: 20251126015721_aab2f192-34de-4312-9d91-f909f7183456.sql
-- Fix security warnings: Add SET search_path = public to all functions
-- This prevents SQL injection attacks through search_path manipulation

-- 1. get_daily_metrics
CREATE OR REPLACE FUNCTION public.get_daily_metrics(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(date date, incoming_count bigint, broadcast_count bigint, scheduled_count bigint, leads_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
DECLARE
  day_date date;
BEGIN
  IF start_date IS NULL OR end_date IS NULL THEN
    RAISE EXCEPTION 'start_date e end_date são obrigatórios';
  END IF;
  
  day_date := DATE(start_date);
  
  WHILE day_date <= DATE(end_date) LOOP
    RETURN QUERY
    SELECT 
      day_date as date,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM whatsapp_messages
        WHERE DATE(timestamp) = day_date
        AND direction = 'incoming'
      ), 0)::bigint as incoming_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM broadcast_queue
        WHERE DATE(sent_at) = day_date
        AND status = 'sent'
      ), 0)::bigint as broadcast_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM scheduled_messages
        WHERE DATE(sent_at) = day_date
        AND status = 'sent'
      ), 0)::bigint as scheduled_count,
      COALESCE((
        SELECT COUNT(*)::bigint 
        FROM leads
        WHERE DATE(created_at) <= day_date
        AND deleted_at IS NULL
      ), 0)::bigint as leads_count;
    
    day_date := day_date + INTERVAL '1 day';
  END LOOP;
END;
$function$;

-- 2. get_organization_metrics
CREATE OR REPLACE FUNCTION public.get_organization_metrics(current_month_start timestamp with time zone, current_month_end timestamp with time zone, previous_month_start timestamp with time zone, previous_month_end timestamp with time zone)
 RETURNS TABLE(org_id uuid, org_name text, current_incoming bigint, current_broadcast bigint, current_scheduled bigint, current_leads bigint, prev_incoming bigint, prev_broadcast bigint, prev_scheduled bigint, prev_leads bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
BEGIN
  IF current_month_start IS NULL OR current_month_end IS NULL OR
     previous_month_start IS NULL OR previous_month_end IS NULL THEN
    RAISE EXCEPTION 'Todos os parâmetros de data são obrigatórios';
  END IF;

  RETURN QUERY
  SELECT 
    o.id as org_id,
    o.name as org_name,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM whatsapp_messages
      WHERE organization_id = o.id
      AND direction = 'incoming'
      AND timestamp BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_incoming,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM broadcast_queue
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_broadcast,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM scheduled_messages
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN current_month_start AND current_month_end
    ), 0)::bigint as current_scheduled,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM leads
      WHERE organization_id = o.id
      AND deleted_at IS NULL
    ), 0)::bigint as current_leads,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM whatsapp_messages
      WHERE organization_id = o.id
      AND direction = 'incoming'
      AND timestamp BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_incoming,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM broadcast_queue
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_broadcast,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM scheduled_messages
      WHERE organization_id = o.id
      AND status = 'sent'
      AND sent_at BETWEEN previous_month_start AND previous_month_end
    ), 0)::bigint as prev_scheduled,
    COALESCE((
      SELECT COUNT(*)::bigint 
      FROM leads
      WHERE organization_id = o.id
      AND deleted_at IS NULL
      AND created_at <= previous_month_end
    ), 0)::bigint as prev_leads
  FROM organizations o
  ORDER BY o.name;
END;
$function$;

-- 3. increment_unread_count
CREATE OR REPLACE FUNCTION public.increment_unread_count(lead_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  UPDATE leads 
  SET unread_message_count = COALESCE(unread_message_count, 0) + 1
  WHERE id = lead_id_param;
END;
$function$;

-- 4. maybe_create_pipeline_stages_for_org
CREATE OR REPLACE FUNCTION public.maybe_create_pipeline_stages_for_org()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  stages_exist boolean;
  target_user uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_stages ps
    WHERE ps.organization_id = NEW.organization_id
  ) INTO stages_exist;

  IF stages_exist THEN
    RETURN NEW;
  END IF;

  SELECT om.user_id
  INTO target_user
  FROM public.organization_members om
  WHERE om.organization_id = NEW.organization_id
    AND (om.role = 'owner' OR om.role = 'admin')
  ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END
  LIMIT 1;

  IF target_user IS NULL THEN
    target_user := NEW.user_id;
  END IF;

  INSERT INTO public.pipeline_stages (id, name, color, position, organization_id, user_id)
  VALUES
    (gen_random_uuid(), 'Novo Lead', '#6366f1', 0, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Em Negociação', '#22c55e', 1, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Aguardando Retorno', '#f59e0b', 2, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Fechado', '#6b7280', 3, NEW.organization_id, target_user)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 5-23. Update all update_*_updated_at trigger functions
CREATE OR REPLACE FUNCTION public.update_agents_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_automation_flows_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_broadcast_time_windows_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_bubble_message_tracking_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_calendar_events_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_calendar_message_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- DESABILITADO: Chatwoot removido do projeto
-- CREATE OR REPLACE FUNCTION public.update_chatwoot_configs_updated_at()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SET search_path = public
-- AS $function$
-- BEGIN
--   NEW.updated_at = now();
--   RETURN NEW;
-- END;
-- $function$;

CREATE OR REPLACE FUNCTION public.update_facebook_configs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_flow_executions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_follow_up_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_form_builders_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_gmail_configs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_google_calendar_configs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_instance_groups_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_mercado_pago_configs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_mercado_pago_payments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_openai_configs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_scheduled_messages_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_whatsapp_boletos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

COMMIT;

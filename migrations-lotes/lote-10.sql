-- ============================================
-- Lote 10 de Migrations
-- Migrations 181 até 200
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


-- Migration: 20251126161344_d455edb0-31b3-467a-be0a-50dae2f09796.sql
-- Função para calcular métricas de saúde e score de risco de instâncias Evolution API
CREATE OR REPLACE FUNCTION public.get_instance_risk_score(
  p_instance_id TEXT,
  p_hours_back INT DEFAULT 24
)
RETURNS TABLE (
  instance_id TEXT,
  risk_score INT,
  error_rate NUMERIC,
  messages_sent_total INT,
  messages_failed_total INT,
  consecutive_failures_max INT,
  rate_limits_detected INT,
  connection_state_changes_total INT,
  last_connection_state TEXT,
  last_error_message TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_messages_sent INT := 0;
  v_messages_failed INT := 0;
  v_error_rate NUMERIC := 0;
  v_consecutive_failures INT := 0;
  v_rate_limits INT := 0;
  v_connection_changes INT := 0;
  v_last_state TEXT;
  v_last_error TEXT;
  v_risk_score INT := 0;
BEGIN
  -- Definir período de análise
  v_period_end := NOW();
  v_period_start := v_period_end - (p_hours_back || ' hours')::INTERVAL;

  -- Contar mensagens enviadas via scheduled_messages
  SELECT COUNT(*)
  INTO v_messages_sent
  FROM public.scheduled_messages
  WHERE instance_id = p_instance_id
    AND sent_at >= v_period_start
    AND sent_at <= v_period_end
    AND status = 'sent';

  -- Contar mensagens falhadas
  SELECT COUNT(*)
  INTO v_messages_failed
  FROM public.scheduled_messages
  WHERE instance_id = p_instance_id
    AND sent_at >= v_period_start
    AND sent_at <= v_period_end
    AND status = 'failed';

  -- Calcular taxa de erro
  IF (v_messages_sent + v_messages_failed) > 0 THEN
    v_error_rate := (v_messages_failed::NUMERIC / (v_messages_sent + v_messages_failed)) * 100;
  END IF;

  -- Detectar rate limits nos logs (buscar por padrões de erro conhecidos)
  SELECT COUNT(*)
  INTO v_rate_limits
  FROM public.evolution_logs
  WHERE instance = p_instance_id
    AND created_at >= v_period_start
    AND created_at <= v_period_end
    AND (
      message ILIKE '%rate limit%'
      OR message ILIKE '%too many requests%'
      OR message ILIKE '%429%'
    );

  -- Contar mudanças de estado de conexão
  SELECT COUNT(*)
  INTO v_connection_changes
  FROM public.evolution_logs
  WHERE instance = p_instance_id
    AND created_at >= v_period_start
    AND created_at <= v_period_end
    AND event IN ('connection.update', 'status.instance', 'qrcode.updated');

  -- Obter último estado e erro
  SELECT 
    COALESCE(payload->>'state', payload->>'status')::TEXT,
    message
  INTO v_last_state, v_last_error
  FROM public.evolution_logs
  WHERE instance = p_instance_id
    AND created_at >= v_period_start
    AND created_at <= v_period_end
    AND level = 'error'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Calcular consecutive failures (máximo de falhas consecutivas)
  -- Isso é uma aproximação baseada em mensagens falhadas recentes
  WITH recent_failures AS (
    SELECT 
      status,
      sent_at,
      LAG(status) OVER (ORDER BY sent_at) as prev_status
    FROM public.scheduled_messages
    WHERE instance_id = p_instance_id
      AND sent_at >= v_period_start
      AND sent_at <= v_period_end
      AND status IN ('sent', 'failed')
    ORDER BY sent_at DESC
    LIMIT 100
  )
  SELECT COALESCE(MAX(consecutive_count), 0)
  INTO v_consecutive_failures
  FROM (
    SELECT 
      COUNT(*) as consecutive_count
    FROM (
      SELECT 
        status,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) 
          OVER (ORDER BY sent_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as grp
      FROM recent_failures
      WHERE status = 'failed'
    ) grouped
    GROUP BY grp
  ) counts;

  -- Calcular score de risco (0-100)
  -- Pesos: error_rate (40%), rate_limits (30%), consecutive_failures (20%), connection_changes (10%)
  v_risk_score := LEAST(100, 
    (LEAST(v_error_rate, 100) * 0.4)::INT +
    (LEAST(v_rate_limits * 10, 100) * 0.3)::INT +
    (LEAST(v_consecutive_failures * 5, 100) * 0.2)::INT +
    (LEAST(v_connection_changes * 2, 100) * 0.1)::INT
  );

  -- Retornar resultado
  RETURN QUERY SELECT
    p_instance_id,
    v_risk_score,
    ROUND(v_error_rate, 2),
    v_messages_sent,
    v_messages_failed,
    v_consecutive_failures,
    v_rate_limits,
    v_connection_changes,
    v_last_state,
    v_last_error,
    v_period_start,
    v_period_end;
END;
$$;

-- Migration: 20251126161703_39e15118-9433-4fc5-ae25-fd2859e05736.sql
-- Corrigir função para usar UUID ao invés de TEXT
DROP FUNCTION IF EXISTS public.get_instance_risk_score(TEXT, INT);

CREATE OR REPLACE FUNCTION public.get_instance_risk_score(
  p_instance_id UUID,
  p_hours_back INT DEFAULT 24
)
RETURNS TABLE (
  instance_id UUID,
  risk_score INT,
  error_rate NUMERIC,
  messages_sent_total INT,
  messages_failed_total INT,
  consecutive_failures_max INT,
  rate_limits_detected INT,
  connection_state_changes_total INT,
  last_connection_state TEXT,
  last_error_message TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_messages_sent INT := 0;
  v_messages_failed INT := 0;
  v_error_rate NUMERIC := 0;
  v_consecutive_failures INT := 0;
  v_rate_limits INT := 0;
  v_connection_changes INT := 0;
  v_last_state TEXT;
  v_last_error TEXT;
  v_risk_score INT := 0;
BEGIN
  -- Definir período de análise
  v_period_end := NOW();
  v_period_start := v_period_end - (p_hours_back || ' hours')::INTERVAL;

  -- Contar mensagens enviadas via scheduled_messages
  SELECT COUNT(*)
  INTO v_messages_sent
  FROM public.scheduled_messages sm
  WHERE sm.instance_id = p_instance_id
    AND sm.sent_at >= v_period_start
    AND sm.sent_at <= v_period_end
    AND sm.status = 'sent';

  -- Contar mensagens falhadas
  SELECT COUNT(*)
  INTO v_messages_failed
  FROM public.scheduled_messages sm
  WHERE sm.instance_id = p_instance_id
    AND sm.sent_at >= v_period_start
    AND sm.sent_at <= v_period_end
    AND sm.status = 'failed';

  -- Calcular taxa de erro
  IF (v_messages_sent + v_messages_failed) > 0 THEN
    v_error_rate := (v_messages_failed::NUMERIC / (v_messages_sent + v_messages_failed)) * 100;
  END IF;

  -- Detectar rate limits nos logs (buscar por padrões de erro conhecidos)
  SELECT COUNT(*)
  INTO v_rate_limits
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND (
      el.message ILIKE '%rate limit%'
      OR el.message ILIKE '%too many requests%'
      OR el.message ILIKE '%429%'
    );

  -- Contar mudanças de estado de conexão
  SELECT COUNT(*)
  INTO v_connection_changes
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND el.event IN ('connection.update', 'status.instance', 'qrcode.updated');

  -- Obter último estado e erro
  SELECT 
    COALESCE(el.payload->>'state', el.payload->>'status')::TEXT,
    el.message
  INTO v_last_state, v_last_error
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND el.level = 'error'
  ORDER BY el.created_at DESC
  LIMIT 1;

  -- Calcular consecutive failures (máximo de falhas consecutivas)
  WITH recent_failures AS (
    SELECT 
      sm.status,
      sm.sent_at,
      LAG(sm.status) OVER (ORDER BY sm.sent_at) as prev_status
    FROM public.scheduled_messages sm
    WHERE sm.instance_id = p_instance_id
      AND sm.sent_at >= v_period_start
      AND sm.sent_at <= v_period_end
      AND sm.status IN ('sent', 'failed')
    ORDER BY sm.sent_at DESC
    LIMIT 100
  )
  SELECT COALESCE(MAX(consecutive_count), 0)
  INTO v_consecutive_failures
  FROM (
    SELECT 
      COUNT(*) as consecutive_count
    FROM (
      SELECT 
        rf.status,
        SUM(CASE WHEN rf.status = 'sent' THEN 1 ELSE 0 END) 
          OVER (ORDER BY rf.sent_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as grp
      FROM recent_failures rf
      WHERE rf.status = 'failed'
    ) grouped
    GROUP BY grp
  ) counts;

  -- Calcular score de risco (0-100)
  v_risk_score := LEAST(100, 
    (LEAST(v_error_rate, 100) * 0.4)::INT +
    (LEAST(v_rate_limits * 10, 100) * 0.3)::INT +
    (LEAST(v_consecutive_failures * 5, 100) * 0.2)::INT +
    (LEAST(v_connection_changes * 2, 100) * 0.1)::INT
  );

  -- Retornar resultado
  RETURN QUERY SELECT
    p_instance_id,
    v_risk_score,
    ROUND(v_error_rate, 2),
    v_messages_sent,
    v_messages_failed,
    v_consecutive_failures,
    v_rate_limits,
    v_connection_changes,
    v_last_state,
    v_last_error,
    v_period_start,
    v_period_end;
END;
$$;

-- Migration: 20251126183334_c8c99dc2-7fb7-485f-aa76-1ff0bbc8c8dc.sql
-- Atualizar função get_instance_risk_score para incluir broadcast_queue
CREATE OR REPLACE FUNCTION public.get_instance_risk_score(
  p_instance_id UUID,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  instance_id UUID,
  risk_score INTEGER,
  error_rate NUMERIC,
  messages_sent_total INTEGER,
  messages_failed_total INTEGER,
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_messages_sent INT := 0;
  v_messages_failed INT := 0;
  v_error_rate NUMERIC := 0;
  v_consecutive_failures INT := 0;
  v_rate_limits INT := 0;
  v_connection_changes INT := 0;
  v_last_state TEXT;
  v_last_error TEXT;
  v_risk_score INT := 0;
  v_scheduled_sent INT := 0;
  v_scheduled_failed INT := 0;
  v_broadcast_sent INT := 0;
  v_broadcast_failed INT := 0;
BEGIN
  v_period_end := NOW();
  v_period_start := v_period_end - (p_hours_back || ' hours')::INTERVAL;

  -- Contar mensagens de scheduled_messages
  SELECT 
    COALESCE(SUM(CASE WHEN sm.status = 'sent' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN sm.status = 'failed' THEN 1 ELSE 0 END), 0)
  INTO v_scheduled_sent, v_scheduled_failed
  FROM public.scheduled_messages sm
  WHERE sm.instance_id = p_instance_id
    AND sm.sent_at >= v_period_start
    AND sm.sent_at <= v_period_end
    AND sm.status IN ('sent', 'failed');

  -- Contar mensagens de broadcast_queue
  SELECT 
    COALESCE(SUM(CASE WHEN bq.status = 'sent' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN bq.status = 'failed' THEN 1 ELSE 0 END), 0)
  INTO v_broadcast_sent, v_broadcast_failed
  FROM public.broadcast_queue bq
  WHERE bq.instance_id = p_instance_id
    AND bq.sent_at >= v_period_start
    AND bq.sent_at <= v_period_end
    AND bq.status IN ('sent', 'failed');

  -- Somar totais
  v_messages_sent := v_scheduled_sent + v_broadcast_sent;
  v_messages_failed := v_scheduled_failed + v_broadcast_failed;

  -- Calcular taxa de erro
  IF (v_messages_sent + v_messages_failed) > 0 THEN
    v_error_rate := (v_messages_failed::NUMERIC / (v_messages_sent + v_messages_failed)) * 100;
  END IF;

  -- Detectar rate limits nos logs
  SELECT COUNT(*)
  INTO v_rate_limits
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND (
      el.message ILIKE '%rate limit%'
      OR el.message ILIKE '%too many requests%'
      OR el.message ILIKE '%429%'
    );

  -- Contar mudanças de estado de conexão
  SELECT COUNT(*)
  INTO v_connection_changes
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND el.event IN ('connection.update', 'status.instance', 'qrcode.updated');

  -- Obter último estado e erro
  SELECT 
    COALESCE(el.payload->>'state', el.payload->>'status')::TEXT,
    el.message
  INTO v_last_state, v_last_error
  FROM public.evolution_logs el
  WHERE el.instance = p_instance_id::TEXT
    AND el.created_at >= v_period_start
    AND el.created_at <= v_period_end
    AND el.level = 'error'
  ORDER BY el.created_at DESC
  LIMIT 1;

  -- Calcular consecutive failures (usando ambas as tabelas)
  WITH recent_failures AS (
    -- Scheduled messages
    SELECT sm.status, sm.sent_at as timestamp
    FROM public.scheduled_messages sm
    WHERE sm.instance_id = p_instance_id
      AND sm.sent_at >= v_period_start
      AND sm.sent_at <= v_period_end
      AND sm.status IN ('sent', 'failed')
    UNION ALL
    -- Broadcast messages
    SELECT bq.status, bq.sent_at as timestamp
    FROM public.broadcast_queue bq
    WHERE bq.instance_id = p_instance_id
      AND bq.sent_at >= v_period_start
      AND bq.sent_at <= v_period_end
      AND bq.status IN ('sent', 'failed')
    ORDER BY timestamp DESC
    LIMIT 100
  )
  SELECT COALESCE(MAX(consecutive_count), 0)
  INTO v_consecutive_failures
  FROM (
    SELECT COUNT(*) as consecutive_count
    FROM (
      SELECT 
        rf.status,
        SUM(CASE WHEN rf.status = 'sent' THEN 1 ELSE 0 END) 
          OVER (ORDER BY rf.timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as grp
      FROM recent_failures rf
      WHERE rf.status = 'failed'
    ) grouped
    GROUP BY grp
  ) counts;

  -- Calcular score de risco (0-100)
  v_risk_score := LEAST(100, 
    (LEAST(v_error_rate, 100) * 0.4)::INT +
    (LEAST(v_rate_limits * 10, 100) * 0.3)::INT +
    (LEAST(v_consecutive_failures * 5, 100) * 0.2)::INT +
    (LEAST(v_connection_changes * 2, 100) * 0.1)::INT
  );

  RETURN QUERY SELECT
    p_instance_id,
    v_risk_score,
    ROUND(v_error_rate, 2),
    v_messages_sent,
    v_messages_failed,
    v_consecutive_failures,
    v_rate_limits,
    v_connection_changes,
    v_last_state,
    v_last_error,
    v_period_start,
    v_period_end;
END;
$$;

-- Migration: 20251127185357_e8484a43-eb55-4e7a-82c7-d33382cbe21a.sql

-- Corrigir política RLS de INSERT para whatsapp_workflow_groups
DROP POLICY IF EXISTS "Users can insert organization workflow groups" ON public.whatsapp_workflow_groups;

CREATE POLICY "Users can insert organization workflow groups" 
ON public.whatsapp_workflow_groups
FOR INSERT
TO public
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);


-- Migration: 20251128000000_fix_workflow_list_id_for_groups.sql
-- Migração: Permitir workflow_list_id NULL para workflows de grupo
-- Quando recipient_mode = 'group', workflow_list_id deve ser NULL

-- Remover constraint NOT NULL da coluna workflow_list_id
ALTER TABLE public.whatsapp_workflows
  ALTER COLUMN workflow_list_id DROP NOT NULL;

-- Adicionar constraint CHECK para garantir que:
-- - Se recipient_mode = 'group', então workflow_list_id deve ser NULL
-- - Se recipient_mode != 'group', então workflow_list_id não deve ser NULL
ALTER TABLE public.whatsapp_workflows
  DROP CONSTRAINT IF EXISTS whatsapp_workflows_workflow_list_id_check;

ALTER TABLE public.whatsapp_workflows
  ADD CONSTRAINT whatsapp_workflows_workflow_list_id_check
  CHECK (
    (recipient_mode = 'group' AND workflow_list_id IS NULL)
    OR
    (recipient_mode != 'group' AND workflow_list_id IS NOT NULL)
  );

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_workflows.workflow_list_id IS 
  'ID da lista de contatos (obrigatório para list e single, NULL para group)';





-- Migration: 20251128020518_f2eb9cfb-0056-4e80-81e7-c5236b78da29.sql
-- Adicionar campos faltantes na tabela whatsapp_boletos
ALTER TABLE public.whatsapp_boletos 
  ADD COLUMN IF NOT EXISTS data_pagamento date,
  ADD COLUMN IF NOT EXISTS valor_pago numeric(10, 2),
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.profiles(id);

-- Criar índice para criado_por
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_criado_por
  ON public.whatsapp_boletos (criado_por);

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_boletos.data_pagamento IS 'Data em que o boleto foi pago';
COMMENT ON COLUMN public.whatsapp_boletos.valor_pago IS 'Valor efetivamente pago (pode ser diferente do valor do boleto)';
COMMENT ON COLUMN public.whatsapp_boletos.criado_por IS 'Usuário que criou o boleto no sistema';

-- Migration: 20251130001332_7e0b1327-2f07-43dd-bb9a-23db888bb972.sql
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

-- Migration: 20251130001403_92844884-06b3-4aab-b5d8-ef25a8ad5b8b.sql
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

-- Migration: 20251130001609_36fc945f-30d5-49ea-8224-efe61909e8cb.sql
-- Corrigir search_path das funções criadas anteriormente

CREATE OR REPLACE FUNCTION public.update_google_business_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.update_google_business_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path TO 'public';

-- Migration: 20251130140305_72041334-6ce2-4524-a187-2ec745852f31.sql
-- Garantir que o bucket existe e é público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-workflow-media',
  'whatsapp-workflow-media',
  true,
  16777216, -- 16MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 16777216,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow authenticated users to upload status media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to status media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their status media" ON storage.objects;

-- Política para permitir usuários autenticados fazerem upload
CREATE POLICY "Allow authenticated users to upload status media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-workflow-media');

-- Política para permitir acesso público a leitura (CRÍTICO para Evolution API)
CREATE POLICY "Allow public read access to status media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-workflow-media');

-- Política para permitir usuários autenticados deletarem seus próprios arquivos
CREATE POLICY "Allow authenticated users to delete their status media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-workflow-media');

-- Migration: 20251201140113_17565d18-cfcb-4564-ab4a-fc50f6c392e1.sql

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can add tags to their leads" ON public.lead_tags;
DROP POLICY IF EXISTS "Users can remove tags from their leads" ON public.lead_tags;
DROP POLICY IF EXISTS "Users can view tags on their leads" ON public.lead_tags;

-- Create new organization-scoped policies for lead_tags
CREATE POLICY "Users can add tags to organization leads"
ON public.lead_tags
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove tags from organization leads"
ON public.lead_tags
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view tags on organization leads"
ON public.lead_tags
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_tags.lead_id
      AND om.user_id = auth.uid()
  )
);


-- Migration: 20251201202933_de7ce118-48bc-40b5-9b3d-661b094b0ec4.sql
-- =====================================================
-- MIGRATION: Sistema de Pós-Venda (Post-Sale Pipeline)
-- =====================================================

-- Tabela: post_sale_stages (Etapas do Funil de Pós-Venda)
CREATE TABLE IF NOT EXISTS public.post_sale_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Tabela: post_sale_leads (Leads/Clientes do Pós-Venda)
CREATE TABLE IF NOT EXISTS public.post_sale_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.post_sale_stages(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  value NUMERIC,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'manual',
  assigned_to TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ DEFAULT now(),
  original_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Tabela: post_sale_activities (Atividades dos Leads de Pós-Venda)
CREATE TABLE IF NOT EXISTS public.post_sale_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'whatsapp', 'call', 'note', 'status_change'
  content TEXT NOT NULL,
  direction TEXT, -- 'incoming', 'outgoing'
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: post_sale_lead_tags (Tags dos Leads de Pós-Venda)
CREATE TABLE IF NOT EXISTS public.post_sale_lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_sale_lead_id, tag_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_post_sale_stages_org ON public.post_sale_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_org ON public.post_sale_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_stage ON public.post_sale_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_phone ON public.post_sale_leads(phone);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_deleted ON public.post_sale_leads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_post_sale_activities_lead ON public.post_sale_activities(post_sale_lead_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_lead_tags_lead ON public.post_sale_lead_tags(post_sale_lead_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_lead_tags_tag ON public.post_sale_lead_tags(tag_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.post_sale_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_lead_tags ENABLE ROW LEVEL SECURITY;

-- Policies para post_sale_stages
CREATE POLICY "Users can view stages from their org"
  ON public.post_sale_stages FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert stages in their org"
  ON public.post_sale_stages FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update stages in their org"
  ON public.post_sale_stages FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete stages in their org"
  ON public.post_sale_stages FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Policies para post_sale_leads
CREATE POLICY "Users can view leads from their org"
  ON public.post_sale_leads FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert leads in their org"
  ON public.post_sale_leads FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update leads in their org"
  ON public.post_sale_leads FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete leads in their org"
  ON public.post_sale_leads FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Policies para post_sale_activities
CREATE POLICY "Users can view activities from their org"
  ON public.post_sale_activities FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert activities in their org"
  ON public.post_sale_activities FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update activities in their org"
  ON public.post_sale_activities FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete activities in their org"
  ON public.post_sale_activities FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Policies para post_sale_lead_tags
CREATE POLICY "Users can view tags from their org leads"
  ON public.post_sale_lead_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.post_sale_leads psl
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND psl.organization_id = get_user_organization(auth.uid())
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can add tags to their org leads"
  ON public.post_sale_lead_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.post_sale_leads psl
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND psl.organization_id = get_user_organization(auth.uid())
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can remove tags from their org leads"
  ON public.post_sale_lead_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.post_sale_leads psl
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND psl.organization_id = get_user_organization(auth.uid())
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- =====================================================
-- FUNÇÃO: Criar etapas padrão de pós-venda
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_default_post_sale_stages(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir etapas padrão apenas se não existirem
  INSERT INTO public.post_sale_stages (organization_id, user_id, name, color, position)
  VALUES
    (p_org_id, p_user_id, 'Novo Cliente', '#10b981', 0),
    (p_org_id, p_user_id, 'Ativação', '#3b82f6', 1),
    (p_org_id, p_user_id, 'Suporte', '#f59e0b', 2),
    (p_org_id, p_user_id, 'Renovação', '#8b5cf6', 3),
    (p_org_id, p_user_id, 'Fidelizado', '#22c55e', 4)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

-- =====================================================
-- TRIGGER: Atualizar updated_at automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_post_sale_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_post_sale_stages_updated_at
  BEFORE UPDATE ON public.post_sale_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_sale_updated_at();

CREATE TRIGGER update_post_sale_leads_updated_at
  BEFORE UPDATE ON public.post_sale_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_sale_updated_at();

-- Migration: 20251204022213_5348f41e-4fc8-41d6-a46a-9b419a25821f.sql
-- Criar tabela n8n_configs para integração com n8n
CREATE TABLE IF NOT EXISTS public.n8n_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_connection_test TIMESTAMPTZ,
  connection_status TEXT NOT NULL DEFAULT 'unknown' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Índice para busca por organização
CREATE INDEX IF NOT EXISTS idx_n8n_configs_org ON public.n8n_configs(organization_id);

-- Habilitar RLS
ALTER TABLE public.n8n_configs ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view their org n8n config"
  ON public.n8n_configs FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert their org n8n config"
  ON public.n8n_configs FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update their org n8n config"
  ON public.n8n_configs FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete their org n8n config"
  ON public.n8n_configs FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_n8n_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_n8n_configs_updated_at ON public.n8n_configs;
CREATE TRIGGER trigger_n8n_configs_updated_at
  BEFORE UPDATE ON public.n8n_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_n8n_configs_updated_at();

-- Migration: 20251209172839_a55f6357-c80e-46df-836a-8ac7f54b69de.sql
-- Add excluded_from_funnel column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS excluded_from_funnel boolean DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_excluded_from_funnel ON public.leads(excluded_from_funnel);

-- Migration: 20251209203359_7f41d77b-4b00-4481-8c55-a6c3469d4ada.sql
-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'un',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(organization_id, sku)
);

-- Tabela de Metas de Vendedor
CREATE TABLE IF NOT EXISTS public.seller_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  goal_type TEXT NOT NULL DEFAULT 'revenue', -- revenue, deals, leads
  target_value NUMERIC(12,2) NOT NULL,
  current_value NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'in_progress', -- in_progress, achieved, missed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id, period_start, period_end, goal_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_seller_goals_org ON public.seller_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_user ON public.seller_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_period ON public.seller_goals(period_start, period_end);

-- RLS para Products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products in their org"
ON public.products FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can insert products in their org"
ON public.products FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update products in their org"
ON public.products FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete products in their org"
ON public.products FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS para Seller Goals
ALTER TABLE public.seller_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view goals in their org"
ON public.seller_goals FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Admins can insert goals"
ON public.seller_goals FOR INSERT
WITH CHECK (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update goals"
ON public.seller_goals FOR UPDATE
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete goals"
ON public.seller_goals FOR DELETE
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Triggers para updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_goals_updated_at
  BEFORE UPDATE ON public.seller_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251209203650_0994de61-30d2-4f40-be03-769d6fcdf522.sql
-- Tabela de Planos
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_period TEXT DEFAULT 'monthly', -- monthly, yearly
  max_leads INTEGER,
  max_users INTEGER,
  max_instances INTEGER,
  max_broadcasts_per_month INTEGER,
  max_scheduled_messages_per_month INTEGER,
  max_storage_gb NUMERIC(10,2),
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Limites por Organização
CREATE TABLE IF NOT EXISTS public.organization_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID REFERENCES public.plans(id),
  max_leads INTEGER,
  max_users INTEGER,
  max_instances INTEGER,
  max_broadcasts_per_month INTEGER,
  max_scheduled_messages_per_month INTEGER,
  max_storage_gb NUMERIC(10,2),
  current_leads_count INTEGER DEFAULT 0,
  current_users_count INTEGER DEFAULT 0,
  current_instances_count INTEGER DEFAULT 0,
  current_month_broadcasts INTEGER DEFAULT 0,
  current_month_scheduled INTEGER DEFAULT 0,
  current_storage_used_gb NUMERIC(10,2) DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Comissões de Vendedor
CREATE TABLE IF NOT EXISTS public.seller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  sale_value NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_value NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, paid
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Produtos vinculados a Leads
CREATE TABLE IF NOT EXISTS public.lead_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, product_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_organization_limits_org ON public.organization_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_limits_plan ON public.organization_limits(plan_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_org ON public.seller_commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_user ON public.seller_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_status ON public.seller_commissions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_products_lead ON public.lead_products(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_products_product ON public.lead_products(product_id);

-- RLS Plans (público para leitura, admin para escrita)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.plans FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Only admins can manage plans"
ON public.plans FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- RLS Organization Limits
ALTER TABLE public.organization_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org limits"
ON public.organization_limits FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Admins can manage org limits"
ON public.organization_limits FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- RLS Seller Commissions
ALTER TABLE public.seller_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view commissions in their org"
ON public.seller_commissions FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Admins can insert commissions"
ON public.seller_commissions FOR INSERT
WITH CHECK (
  user_is_org_admin(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update commissions"
ON public.seller_commissions FOR UPDATE
USING (
  user_is_org_admin(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete commissions"
ON public.seller_commissions FOR DELETE
USING (
  user_is_org_admin(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Lead Products
ALTER TABLE public.lead_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lead products in their org"
ON public.lead_products FOR SELECT
USING (
  lead_id IN (
    SELECT id FROM leads WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can insert lead products in their org"
ON public.lead_products FOR INSERT
WITH CHECK (
  lead_id IN (
    SELECT id FROM leads WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update lead products in their org"
ON public.lead_products FOR UPDATE
USING (
  lead_id IN (
    SELECT id FROM leads WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete lead products in their org"
ON public.lead_products FOR DELETE
USING (
  lead_id IN (
    SELECT id FROM leads WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Triggers
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_limits_updated_at
  BEFORE UPDATE ON public.organization_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_commissions_updated_at
  BEFORE UPDATE ON public.seller_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251209210023_faf75e61-2d8e-4de2-b69c-d56430cec201.sql
-- Add commission columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS commission_percentage numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS commission_fixed numeric DEFAULT NULL;

-- Migration: 20251210000000_create_products_and_link_to_leads.sql
-- Criar tabela de produtos/serviços
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_products_organization ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);

-- Habilitar RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para products
CREATE POLICY "Users can view products of their organization"
ON public.products FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create products for their organization"
ON public.products FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update products of their organization"
ON public.products FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete products of their organization"
ON public.products FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Adicionar coluna product_id na tabela leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Criar índice para product_id
CREATE INDEX IF NOT EXISTS idx_leads_product ON public.leads(product_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.products IS 'Tabela de produtos/serviços que podem ser vinculados a leads';
COMMENT ON COLUMN public.products.name IS 'Nome do produto ou serviço';
COMMENT ON COLUMN public.products.price IS 'Preço do produto ou serviço';
COMMENT ON COLUMN public.products.category IS 'Categoria do produto ou serviço';
COMMENT ON COLUMN public.products.active IS 'Indica se o produto está ativo e disponível para venda';
COMMENT ON COLUMN public.leads.product_id IS 'Referência ao produto/serviço vinculado ao lead';





-- Migration: 20251210000001_add_commission_and_goals.sql
-- Adicionar campo de comissão na tabela products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  ADD COLUMN IF NOT EXISTS commission_fixed DECIMAL(10, 2) DEFAULT 0 CHECK (commission_fixed >= 0);

-- Criar tabela de metas para vendedores
CREATE TABLE IF NOT EXISTS public.seller_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'weekly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_leads INTEGER DEFAULT 0,
  target_value DECIMAL(10, 2) DEFAULT 0,
  target_commission DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(organization_id, user_id, period_type, period_start)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_seller_goals_organization ON public.seller_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_user ON public.seller_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_goals_period ON public.seller_goals(period_type, period_start, period_end);

-- Habilitar RLS
ALTER TABLE public.seller_goals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para seller_goals
CREATE POLICY "Users can view goals of their organization"
ON public.seller_goals FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create goals for their organization"
ON public.seller_goals FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update goals of their organization"
ON public.seller_goals FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete goals of their organization"
ON public.seller_goals FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_seller_goals_updated_at
  BEFORE UPDATE ON public.seller_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON COLUMN public.products.commission_percentage IS 'Percentual de comissão sobre o valor do produto (0-100)';
COMMENT ON COLUMN public.products.commission_fixed IS 'Valor fixo de comissão por venda do produto';
COMMENT ON TABLE public.seller_goals IS 'Metas de vendas e comissões para vendedores';
COMMENT ON COLUMN public.seller_goals.period_type IS 'Tipo de período: monthly, weekly, quarterly, yearly';
COMMENT ON COLUMN public.seller_goals.target_leads IS 'Meta de quantidade de leads ganhos';
COMMENT ON COLUMN public.seller_goals.target_value IS 'Meta de valor total em vendas';
COMMENT ON COLUMN public.seller_goals.target_commission IS 'Meta de comissão total';





-- Migration: 20251210032009_31aaa3b7-1997-4986-ab6a-7c5822f3fb81.sql
-- Create hubspot_configs table for HubSpot integration
CREATE TABLE public.hubspot_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  portal_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hubspot_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their org hubspot config"
  ON public.hubspot_configs FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can insert their org hubspot config"
  ON public.hubspot_configs FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can update their org hubspot config"
  ON public.hubspot_configs FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can delete their org hubspot config"
  ON public.hubspot_configs FOR DELETE
  USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_hubspot_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hubspot_configs_updated_at
  BEFORE UPDATE ON public.hubspot_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hubspot_configs_updated_at();

DROP INDEX IF EXISTS for CASCADE;
CREATE INDEX for ON
-- Create unique index for one active config per organization
CREATE UNIQUE INDEX hubspot_configs_org_active_idx 
  ON public.hubspot_configs(organization_id) 
  WHERE is_active = true;

COMMIT;

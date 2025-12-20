-- ============================================
-- Lote 7 de Migrations
-- Migrations 121 até 140
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


-- Migration: 20251110011936_ef2e231c-a4fa-4cc6-823b-f58823d5b8ed.sql
-- Adicionar campos para rastrear mensagens não lidas nos leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS has_unread_messages BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unread_message_count INTEGER DEFAULT 0;

-- Migration: 20251110012249_1a7cc2d0-1923-40d9-ad07-d3df88728265.sql
-- Criar função para incrementar contador de mensagens não lidas
CREATE OR REPLACE FUNCTION increment_unread_count(lead_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE leads 
  SET unread_message_count = COALESCE(unread_message_count, 0) + 1
  WHERE id = lead_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: 20251110041746_8c6c0465-b3ba-41a6-a0ff-5866eaee02db.sql
-- Update RLS on whatsapp_messages to allow members of an organization (not only the first org)
-- Ensure RLS is enabled (it already is, but safe to include)
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Drop restrictive policies
DROP POLICY IF EXISTS "Users can view organization messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can update organization messages" ON public.whatsapp_messages;

-- Recreate policies using membership check, keeping admin/pubsup overrides
CREATE POLICY "Users can view org messages (membership or admin)"
ON public.whatsapp_messages
FOR SELECT
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update org messages (membership or admin)"
ON public.whatsapp_messages
FOR UPDATE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
)
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);


-- Migration: 20251110045119_f80f96cd-8d8c-4099-9185-9103825910eb.sql
-- Adicionar constraint única para prevenir etapas duplicadas na mesma org
-- (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_org_name_unique 
ON pipeline_stages (organization_id, LOWER(name));

-- Adicionar comentário explicativo
COMMENT ON INDEX pipeline_stages_org_name_unique IS 
'Previne criação de etapas com nomes duplicados (case-insensitive) na mesma organização';

-- Migration: 20251110112346_b5188ba7-e0b7-4c0f-ae9c-bb0fb4ab776e.sql
-- Corrigir função de transferência de dados para incluir created_by
CREATE OR REPLACE FUNCTION public.transfer_user_data_to_admin(_user_id uuid, _org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _admin_id UUID;
BEGIN
  -- Buscar o primeiro admin/owner da organização
  SELECT user_id INTO _admin_id
  FROM public.organization_members
  WHERE organization_id = _org_id
    AND role IN ('owner', 'admin')
    AND user_id != _user_id  -- Não selecionar o próprio usuário sendo deletado
  ORDER BY 
    CASE role 
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
    END
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum administrador encontrado na organização';
  END IF;

  -- Transferir leads (created_by e user_id)
  UPDATE public.leads
  SET created_by = _admin_id
  WHERE created_by = _user_id
    AND organization_id = _org_id;

  UPDATE public.leads
  SET user_id = _admin_id, 
      updated_by = _admin_id,
      updated_at = now()
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  UPDATE public.leads
  SET updated_by = _admin_id
  WHERE updated_by = _user_id
    AND organization_id = _org_id;

  -- Transferir activities
  UPDATE public.activities
  SET user_name = (SELECT full_name FROM profiles WHERE id = _admin_id)
  WHERE lead_id IN (
    SELECT id FROM leads WHERE organization_id = _org_id
  );

  -- Transferir call_queue (created_by e updated_by)
  UPDATE public.call_queue
  SET created_by = _admin_id
  WHERE created_by = _user_id
    AND organization_id = _org_id;

  UPDATE public.call_queue
  SET updated_by = _admin_id
  WHERE updated_by = _user_id
    AND organization_id = _org_id;

  -- Transferir scheduled_messages
  UPDATE public.scheduled_messages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir message_templates
  UPDATE public.message_templates
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir broadcast_campaigns
  UPDATE public.broadcast_campaigns
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir tags
  UPDATE public.tags
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir pipeline_stages
  UPDATE public.pipeline_stages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir evolution_config
  UPDATE public.evolution_config
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir whatsapp_lid_contacts
  UPDATE public.whatsapp_lid_contacts
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir international_contacts
  UPDATE public.international_contacts
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir whatsapp_messages
  UPDATE public.whatsapp_messages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;
END;
$$;

-- Migration: 20251110112547_165999f4-e0c5-458e-be4b-e49dc6e3d189.sql
-- Remover trigger que cria pipeline stages automaticamente na criação de perfil
-- A edge function create-user já cuida disso após adicionar à organização
DROP TRIGGER IF EXISTS create_default_pipeline_stages_trigger ON profiles;

-- Migration: 20251110114436_53051556-ae64-477a-8d51-d69a4170da70.sql
-- Tornar exclusão de perfil segura: só excluir quando não houver nenhuma referência restante
CREATE OR REPLACE FUNCTION public.delete_user_from_organization(_user_id uuid, _org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  refs_exist boolean;
BEGIN
  -- Transferir dados primeiro
  PERFORM public.transfer_user_data_to_admin(_user_id, _org_id);

  -- Remover o usuário da organização
  DELETE FROM public.organization_members
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Se o usuário ainda pertence a alguma organização, não tentar apagar perfil/auth
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id) THEN
    RETURN;
  END IF;

  -- Verificar se ainda existem referências em tabelas principais
  SELECT EXISTS (
    SELECT 1 FROM public.leads WHERE user_id = _user_id OR created_by = _user_id OR updated_by = _user_id
    UNION ALL
    SELECT 1 FROM public.call_queue WHERE created_by = _user_id OR updated_by = _user_id
    UNION ALL
    SELECT 1 FROM public.scheduled_messages WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.message_templates WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.broadcast_campaigns WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.tags WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.pipeline_stages WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.evolution_config WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.whatsapp_lid_contacts WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.international_contacts WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.whatsapp_messages WHERE user_id = _user_id
  ) INTO refs_exist;

  -- Se ainda houver referências, não apagar o perfil para evitar erro de FK
  IF refs_exist THEN
    RETURN; -- Consideramos concluído: removido da org e dados transferidos
  END IF;

  -- Somente agora, sem referências e sem organizações, apagar perfil e auth
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

-- Migration: 20251110115752_509069eb-2ac1-4f74-a198-5a78f754f469.sql
-- Remover todos os triggers que tentam criar pipeline stages automaticamente
-- A edge function create-user cuida de criar os stages após adicionar à organização

DROP TRIGGER IF EXISTS create_pipeline_stages_on_signup ON auth.users;
DROP TRIGGER IF EXISTS on_user_created_pipeline_stages ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recriar apenas o trigger essencial para criar o perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Migration: 20251110115815_f0ebbdbc-1773-4402-8b6b-ee870e6b4d6b.sql
-- Atualizar função handle_new_user para não criar pipeline stages
-- A edge function create-user cuida disso após adicionar à organização
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Apenas inserir perfil se não existir
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Inserir role padrão de usuário se não existir
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- NÃO criar pipeline stages aqui - a edge function faz isso
  
  RETURN NEW;
END;
$function$;

-- Migration: 20251110153008_2c25654a-e382-4e16-bef0-7b192822174a.sql
-- Primeiro, limpar o usuário órfão que foi criado parcialmente
DELETE FROM user_roles WHERE user_id = '96421e53-d098-4439-acff-d7f03bea67da';
DELETE FROM profiles WHERE id = '96421e53-d098-4439-acff-d7f03bea67da';

-- Depois deletar o usuário do auth (precisa ser feito via edge function, então vamos usar uma função helper)
DO $$
BEGIN
  -- Deletar do auth usando a API admin
  PERFORM auth.uid(); -- dummy call para garantir que auth está disponível
EXCEPTION WHEN OTHERS THEN
  -- Se falhar, não tem problema, vamos limpar via edge function
  NULL;
END $$;

-- Verificar e dropar triggers problemáticos que criam pipeline stages ao adicionar membros
DROP TRIGGER IF EXISTS create_pipeline_stages_on_first_member ON organization_members;
DROP TRIGGER IF EXISTS on_organization_member_added ON organization_members;

-- Criar função melhorada para criar pipeline stages SOMENTE se a organização não tiver nenhum
CREATE OR REPLACE FUNCTION public.maybe_create_pipeline_stages_for_org()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage_count INTEGER;
  v_first_member_user_id UUID;
BEGIN
  -- Contar quantos stages essa organização já tem
  SELECT COUNT(*) INTO v_stage_count
  FROM pipeline_stages
  WHERE organization_id = NEW.organization_id;
  
  -- Se já tem stages, não fazer nada
  IF v_stage_count > 0 THEN
    RETURN NEW;
  END IF;
  
  -- Pegar o primeiro membro admin da organização para ser o dono dos stages
  SELECT user_id INTO v_first_member_user_id
  FROM organization_members
  WHERE organization_id = NEW.organization_id
    AND role IN ('owner', 'admin')
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Se não encontrou admin, usar o próprio usuário que está sendo adicionado
  IF v_first_member_user_id IS NULL THEN
    v_first_member_user_id := NEW.user_id;
  END IF;
  
  -- Criar stages padrão para essa organização
  INSERT INTO pipeline_stages (user_id, organization_id, name, color, position)
  VALUES
    (v_first_member_user_id, NEW.organization_id, 'Novo Lead', '#10b981', 0),
    (v_first_member_user_id, NEW.organization_id, 'Qualificação', '#3b82f6', 1),
    (v_first_member_user_id, NEW.organization_id, 'Proposta', '#f59e0b', 2),
    (v_first_member_user_id, NEW.organization_id, 'Negociação', '#8b5cf6', 3),
    (v_first_member_user_id, NEW.organization_id, 'Fechado', '#22c55e', 4)
  ON CONFLICT (user_id, name) DO NOTHING; -- Ignorar se já existir
  
  RETURN NEW;
END;
$$;

-- Criar trigger que só dispara DEPOIS de inserir o membro
CREATE TRIGGER create_pipeline_stages_for_new_org
  AFTER INSERT ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_create_pipeline_stages_for_org();

-- Migration: 20251110162756_28fb31f5-83f3-4e13-bb6e-caad5bac913d.sql
-- Fix duplicate pipeline stage errors when adding members to organizations
-- 1) Drop old per-user unique constraint on pipeline stages
ALTER TABLE public.pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_user_id_name_key;

-- 2) Enforce case-insensitive uniqueness of stage names within an organization
--    (allows same user across multiple orgs without conflicts)
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_org_lower_name_unique
  ON public.pipeline_stages (organization_id, lower(name));

-- 3) Create or replace robust function to create default stages once per org
CREATE OR REPLACE FUNCTION public.maybe_create_pipeline_stages_for_org()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  stages_exist boolean;
  target_user uuid;
BEGIN
  -- If org already has any stages, do nothing
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_stages ps
    WHERE ps.organization_id = NEW.organization_id
  ) INTO stages_exist;

  IF stages_exist THEN
    RETURN NEW;
  END IF;

  -- Pick an owner/admin for the org; fallback to the new member
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

  -- Insert default stages (idempotent via unique index + DO NOTHING)
  INSERT INTO public.pipeline_stages (id, name, color, position, organization_id, user_id)
  VALUES
    (gen_random_uuid(), 'Novo Lead', '#6366f1', 0, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Em Negociação', '#22c55e', 1, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Aguardando Retorno', '#f59e0b', 2, NEW.organization_id, target_user),
    (gen_random_uuid(), 'Fechado', '#6b7280', 3, NEW.organization_id, target_user)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4) Ensure only the correct trigger exists and is wired to the safe function
DROP TRIGGER IF EXISTS create_pipeline_stages_for_new_org ON public.organization_members;
DROP TRIGGER IF EXISTS create_pipeline_stages_on_first_member ON public.organization_members;
DROP TRIGGER IF EXISTS on_organization_member_added ON public.organization_members;

CREATE TRIGGER create_pipeline_stages_for_new_org
AFTER INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.maybe_create_pipeline_stages_for_org();

-- Migration: 20251110170834_49c377c3-71e1-475d-b3df-37811c81e46d.sql
-- Adicionar coluna personalized_message à tabela broadcast_queue
ALTER TABLE public.broadcast_queue
ADD COLUMN personalized_message text;

-- Migration: 20251111142046_465753f8-6e5d-4d69-a7c8-5fe30f226ccd.sql
-- Tabela para armazenar configurações de custo do Lovable Cloud
CREATE TABLE IF NOT EXISTS public.cloud_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Custos por operação (em dólares)
  cost_per_database_read NUMERIC(10, 6) DEFAULT 0.000001,
  cost_per_database_write NUMERIC(10, 6) DEFAULT 0.000001,
  cost_per_storage_gb NUMERIC(10, 6) DEFAULT 0.021,
  cost_per_edge_function_call NUMERIC(10, 6) DEFAULT 0.0000002,
  cost_per_realtime_message NUMERIC(10, 6) DEFAULT 0.0000025,
  cost_per_auth_user NUMERIC(10, 6) DEFAULT 0.00325,
  
  -- Custos customizados para funções específicas
  cost_per_incoming_message NUMERIC(10, 6) DEFAULT 0.0001,
  cost_per_broadcast_message NUMERIC(10, 6) DEFAULT 0.0002,
  cost_per_scheduled_message NUMERIC(10, 6) DEFAULT 0.0001,
  cost_per_lead_storage NUMERIC(10, 6) DEFAULT 0.00001,
  
  -- Notas
  notes TEXT,
  
  -- Apenas uma linha de configuração por vez
  CONSTRAINT single_config_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Inserir configuração padrão
INSERT INTO public.cloud_cost_config (id) 
VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies
ALTER TABLE public.cloud_cost_config ENABLE ROW LEVEL SECURITY;

-- Super admins podem ver
CREATE POLICY "Super admins can view cloud cost config"
  ON public.cloud_cost_config
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_pubdigital_user(auth.uid())
  );

-- Super admins podem atualizar
CREATE POLICY "Super admins can update cloud cost config"
  ON public.cloud_cost_config
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_cloud_cost_config_updated_at
  BEFORE UPDATE ON public.cloud_cost_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251111154302_694c60dd-f77d-48e8-a6bc-f55d721a1363.sql
-- Tabela para armazenar métricas diárias de uso
CREATE TABLE IF NOT EXISTS public.daily_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  metric_type text NOT NULL, -- 'incoming_messages', 'broadcast_messages', 'scheduled_messages', 'database_reads', 'database_writes', 'edge_function_calls', 'storage_gb', 'auth_users', 'leads_stored'
  metric_value numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_daily_usage_metrics_date ON public.daily_usage_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_usage_metrics_org ON public.daily_usage_metrics(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_usage_metrics_type ON public.daily_usage_metrics(metric_type, date DESC);

-- RLS Policies
ALTER TABLE public.daily_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all daily metrics"
  ON public.daily_usage_metrics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Super admins can insert daily metrics"
  ON public.daily_usage_metrics
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Super admins can update daily metrics"
  ON public.daily_usage_metrics
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_daily_usage_metrics_updated_at
  BEFORE UPDATE ON public.daily_usage_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251112001824_188ec3c5-e7eb-4f2b-8300-244ad2b7235b.sql
-- Add organization_id column to broadcast_queue
ALTER TABLE public.broadcast_queue 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Create index for better query performance
DROP INDEX IF EXISTS idx_broadcast_queue_org_id CASCADE;
CREATE INDEX idx_broadcast_queue_org_id ON
CREATE INDEX idx_broadcast_queue_org_id ON public.broadcast_queue(organization_id);
DROP INDEX IF EXISTS idx_broadcast_queue_status_sent_at CASCADE;
CREATE INDEX idx_broadcast_queue_status_sent_at ON
CREATE INDEX idx_broadcast_queue_status_sent_at ON public.broadcast_queue(status, sent_at) WHERE status = 'sent';

-- Create trigger function to automatically set organization_id
CREATE OR REPLACE FUNCTION public.set_broadcast_queue_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Get organization_id from campaign
  SELECT bc.organization_id INTO NEW.organization_id
  FROM public.broadcast_campaigns bc
  WHERE bc.id = NEW.campaign_id;
  
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Campaign % does not have an organization', NEW.campaign_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER set_broadcast_queue_org_before_insert
  BEFORE INSERT ON public.broadcast_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_broadcast_queue_organization();

-- Backfill existing records
UPDATE public.broadcast_queue bq
SET organization_id = bc.organization_id
FROM public.broadcast_campaigns bc
WHERE bq.campaign_id = bc.id
  AND bq.organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
ALTER TABLE public.broadcast_queue 
ALTER COLUMN organization_id SET NOT NULL;

-- Add RLS policies for broadcast_queue with organization_id
DROP POLICY IF EXISTS "Users can view queue of their campaigns" ON public.broadcast_queue;
DROP POLICY IF EXISTS "Users can insert queue for their campaigns" ON public.broadcast_queue;
DROP POLICY IF EXISTS "Users can update queue of their campaigns" ON public.broadcast_queue;
DROP POLICY IF EXISTS "Users can delete queue of their campaigns" ON public.broadcast_queue;

CREATE POLICY "Users can view organization broadcast queue"
  ON public.broadcast_queue
  FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert organization broadcast queue"
  ON public.broadcast_queue
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update organization broadcast queue"
  ON public.broadcast_queue
  FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete organization broadcast queue"
  ON public.broadcast_queue
  FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

-- Migration: 20251112003333_42219074-3bdd-42d6-93c6-6bdd6e66d2e1.sql
-- Create broadcast campaign templates table
CREATE TABLE IF NOT EXISTS public.broadcast_campaign_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  instance_id UUID,
  instance_name TEXT,
  message_template_id UUID,
  custom_message TEXT,
  min_delay_seconds INTEGER NOT NULL DEFAULT 30,
  max_delay_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broadcast_campaign_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcast_campaign_templates
CREATE POLICY "Users can view organization campaign templates"
  ON public.broadcast_campaign_templates
  FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can create organization campaign templates"
  ON public.broadcast_campaign_templates
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization campaign templates"
  ON public.broadcast_campaign_templates
  FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization campaign templates"
  ON public.broadcast_campaign_templates
  FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can view all campaign templates"
  ON public.broadcast_campaign_templates
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_broadcast_campaign_templates_updated_at
  BEFORE UPDATE ON public.broadcast_campaign_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_broadcast_campaign_templates_org_id 
  ON public.broadcast_campaign_templates(organization_id);

-- Migration: 20251112004256_735e5384-b176-4fd0-933e-ba2a268de68e.sql
-- Add message_variations column to broadcast_campaign_templates
ALTER TABLE public.broadcast_campaign_templates
ADD COLUMN message_variations JSONB DEFAULT '[]'::jsonb;

-- Migration: 20251112103524_c119ad29-7a69-4133-9e28-ad9bcd8d31b0.sql
-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view campaign templates from their org" ON public.broadcast_campaign_templates;
DROP POLICY IF EXISTS "Users can create campaign templates for their org" ON public.broadcast_campaign_templates;
DROP POLICY IF EXISTS "Users can update campaign templates from their org" ON public.broadcast_campaign_templates;
DROP POLICY IF EXISTS "Users can delete campaign templates from their org" ON public.broadcast_campaign_templates;

-- Criar políticas RLS corretas para broadcast_campaign_templates
CREATE POLICY "Users can view campaign templates from their org"
ON public.broadcast_campaign_templates
FOR SELECT
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create campaign templates for their org"
ON public.broadcast_campaign_templates
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update campaign templates from their org"
ON public.broadcast_campaign_templates
FOR UPDATE
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete campaign templates from their org"
ON public.broadcast_campaign_templates
FOR DELETE
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Migration: 20251112104335_7d766c57-1d2b-49fe-8fbf-08e9b216d019.sql
-- Corrigir políticas RLS de broadcast_campaigns para suportar múltiplas organizações

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can create organization campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can delete organization campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can update organization campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can view organization campaigns" ON public.broadcast_campaigns;

-- Criar políticas corretas usando user_belongs_to_org
CREATE POLICY "Users can create campaigns for their org"
ON public.broadcast_campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can view campaigns from their org"
ON public.broadcast_campaigns
FOR SELECT
TO authenticated
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update campaigns from their org"
ON public.broadcast_campaigns
FOR UPDATE
TO authenticated
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete campaigns from their org"
ON public.broadcast_campaigns
FOR DELETE
TO authenticated
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Migration: 20251112185501_fde22be2-c9d0-4014-9bf2-26b8297727b8.sql
-- Add instance_id column to broadcast_queue for multi-instance rotation
ALTER TABLE public.broadcast_queue 
ADD COLUMN instance_id UUID REFERENCES public.evolution_config(id);

-- Add index for better query performance
DROP INDEX IF EXISTS idx_broadcast_queue_instance_id CASCADE;
CREATE INDEX idx_broadcast_queue_instance_id ON
CREATE INDEX idx_broadcast_queue_instance_id ON public.broadcast_queue(instance_id);

-- Backfill existing records with instance_id from their campaign
UPDATE public.broadcast_queue bq
SET instance_id = bc.instance_id
FROM public.broadcast_campaigns bc
WHERE bq.campaign_id = bc.id
  AND bq.instance_id IS NULL
  AND bc.instance_id IS NOT NULL;

COMMIT;

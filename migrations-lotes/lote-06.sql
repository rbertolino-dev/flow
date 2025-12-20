-- ============================================
-- Lote 6 de Migrations
-- Migrations 101 até 120
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


-- Migration: 20251108160649_49d5f9ff-a185-452a-a8f8-3acade9c5908.sql
-- 1) Harden Evolution integration with a per-config secret and uniqueness
-- Add webhook_secret to evolution_config
ALTER TABLE public.evolution_config
ADD COLUMN IF NOT EXISTS webhook_secret uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS ux_evolution_config_webhook_secret
ON public.evolution_config (webhook_secret);

-- Optional uniqueness per organization to reduce ambiguity
CREATE UNIQUE INDEX IF NOT EXISTS ux_evolution_config_instance_org
ON public.evolution_config (instance_name, organization_id);

-- 2) Secure RPC for creating leads that bypasses RLS but enforces org membership
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
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_assigned_to text;
  v_stage_exists boolean;
  v_lead_id uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- verify membership in organization
  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
  END IF;

  -- validate stage belongs to same org when provided
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
    source, status, assigned_to, notes, stage_id, last_contact, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, p_phone, p_email, p_company, p_value,
    p_source, 'new', COALESCE(v_assigned_to, 'Sistema'), p_notes, p_stage_id, NOW(), NOW(), NOW()
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

-- Migration: 20251108161355_e170de2b-3add-4451-a5e3-c3596f79738a.sql
-- 1) Drop wrong unique constraint (user_id, phone) and enforce org-level uniqueness
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_user_phone_unique;

-- 2) Ensure phone normalization at DB-level to avoid duplicates with formatting
CREATE OR REPLACE FUNCTION public.normalize_lead_phone()
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

DROP TRIGGER IF EXISTS trg_normalize_lead_phone_ins ON public.leads;
DROP TRIGGER IF EXISTS trg_normalize_lead_phone_upd ON public.leads;
CREATE TRIGGER trg_normalize_lead_phone_ins
BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_lead_phone();
CREATE TRIGGER trg_normalize_lead_phone_upd
BEFORE UPDATE OF phone ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_lead_phone();

-- 3) Unique index by organization + phone for active (not soft-deleted) leads
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_org_phone_active
ON public.leads (organization_id, phone)
WHERE deleted_at IS NULL;

-- 4) Harden create_lead_secure: normalize and deduplicate within organization
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
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.user_belongs_to_org(v_user, p_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização informada';
  END IF;

  IF p_stage_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.pipeline_stages 
      WHERE id = p_stage_id AND organization_id = p_org_id
    ) INTO v_stage_exists;
    IF NOT v_stage_exists THEN
      RAISE EXCEPTION 'Etapa inválida para a organização';
    END IF;
  END IF;

  v_norm_phone := regexp_replace(coalesce(p_phone,''), '\\D', '', 'g');

  -- Return existing active lead if already present in the org
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE organization_id = p_org_id
    AND deleted_at IS NULL
    AND phone = v_norm_phone
  LIMIT 1;

  IF v_lead_id IS NOT NULL THEN
    RETURN v_lead_id;
  END IF;

  SELECT email INTO v_assigned_to FROM public.profiles WHERE id = v_user;

  INSERT INTO public.leads (
    id, user_id, organization_id, name, phone, email, company, value,
    source, status, assigned_to, notes, stage_id, last_contact, created_at, updated_at, created_by, updated_by
  ) VALUES (
    gen_random_uuid(), v_user, p_org_id, p_name, v_norm_phone, p_email, p_company, p_value,
    p_source, 'new', COALESCE(v_assigned_to, 'Sistema'), p_notes, p_stage_id, NOW(), NOW(), NOW(), v_user, v_user
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$func$;

-- Migration: 20251108162559_37609d62-4bc1-4061-a32a-00061eb47330.sql
-- Corrigir RLS policies da tabela activities para permitir inserção de atividades ao mover leads
DROP POLICY IF EXISTS "Users can insert organization activities" ON public.activities;

CREATE POLICY "Users can insert organization activities" 
ON public.activities 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

-- Migration: 20251108195732_a977964a-f5e7-4c15-8031-aee343c470ab.sql
-- Add an INSERT policy for evolution_config so org members can create instances
-- Keeps RLS secure while allowing legitimate inserts

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.evolution_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert configs for their own organization,
-- and only for themselves as the owner of the row
CREATE POLICY insert_evolution_config_members
ON public.evolution_config
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND public.user_belongs_to_org(auth.uid(), organization_id)
);


-- Migration: 20251109025058_8cfe733c-497a-407f-b8a5-18e312f3396a.sql
-- Update RLS policies on pipeline_stages to allow members of any of their organizations
-- Drop existing org-equals policies
DROP POLICY IF EXISTS "Users can create organization pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can delete organization pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can update organization pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can view organization pipeline stages" ON public.pipeline_stages;

-- Recreate policies using membership check
CREATE POLICY "Users can create organization pipeline stages"
ON public.pipeline_stages
FOR INSERT
WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete organization pipeline stages"
ON public.pipeline_stages
FOR DELETE
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update organization pipeline stages"
ON public.pipeline_stages
FOR UPDATE
USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can view organization pipeline stages"
ON public.pipeline_stages
FOR SELECT
USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Migration: 20251109040516_46bb52cc-022b-4de9-8b3b-1b7743a6a813.sql
-- Criar função segura para adicionar lead à fila de ligações
CREATE OR REPLACE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamp with time zone DEFAULT now(),
  p_priority text DEFAULT 'medium',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_org_id uuid;
  v_existing_id uuid;
  v_queue_id uuid;
BEGIN
  -- Verificar autenticação
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Obter organização do lead
  SELECT organization_id INTO v_org_id
  FROM public.leads
  WHERE id = p_lead_id AND deleted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado ou foi deletado';
  END IF;

  -- Verificar se usuário pertence à organização
  IF NOT public.user_belongs_to_org(v_user, v_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização do lead';
  END IF;

  -- Verificar duplicado: já existe pendente ou reagendada para este lead na mesma org?
  SELECT id INTO v_existing_id
  FROM public.call_queue
  WHERE lead_id = p_lead_id
    AND organization_id = v_org_id
    AND status IN ('pending', 'rescheduled')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Retornar o ID do existente para indicar que já estava na fila
    RETURN v_existing_id;
  END IF;

  -- Inserir na fila
  INSERT INTO public.call_queue (
    lead_id,
    organization_id,
    scheduled_for,
    priority,
    notes,
    status,
    created_by
  ) VALUES (
    p_lead_id,
    v_org_id,
    p_scheduled_for,
    p_priority,
    p_notes,
    'pending',
    v_user
  )
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;

-- Migration: 20251109042346_452d2ca2-1653-499d-957e-d7745bd29eaa.sql
-- Fix multi-organization RLS for call queue tables and remove broad pubdigital visibility
-- This migration updates policies so users can act in ANY organization they belong to,
-- and removes the special-case global visibility for pubdigital members on these tables.

begin;

-- CALL_QUEUE -----------------------------------------------------------
-- Remove broad super admin visibility that included is_pubdigital_user
DROP POLICY IF EXISTS "Super admins can view all call_queue" ON public.call_queue;
CREATE POLICY "Super admins can view all call_queue"
ON public.call_queue
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- View
DROP POLICY IF EXISTS "Users can view organization call queue" ON public.call_queue;
CREATE POLICY "Users can view organization call queue"
ON public.call_queue
FOR SELECT
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Insert
DROP POLICY IF EXISTS "Users can insert organization call queue" ON public.call_queue;
CREATE POLICY "Users can insert organization call queue"
ON public.call_queue
FOR INSERT
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update
DROP POLICY IF EXISTS "Users can update organization call queue" ON public.call_queue;
CREATE POLICY "Users can update organization call queue"
ON public.call_queue
FOR UPDATE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Delete
DROP POLICY IF EXISTS "Users can delete organization call queue" ON public.call_queue;
CREATE POLICY "Users can delete organization call queue"
ON public.call_queue
FOR DELETE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- CALL_QUEUE_HISTORY --------------------------------------------------
-- Remove broad super admin visibility that included is_pubdigital_user
DROP POLICY IF EXISTS "Super admins can view all call_queue_history" ON public.call_queue_history;
CREATE POLICY "Super admins can view all call_queue_history"
ON public.call_queue_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- View
DROP POLICY IF EXISTS "Users can view organization call queue history" ON public.call_queue_history;
CREATE POLICY "Users can view organization call queue history"
ON public.call_queue_history
FOR SELECT
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Insert
DROP POLICY IF EXISTS "Users can insert organization call queue history" ON public.call_queue_history;
CREATE POLICY "Users can insert organization call queue history"
ON public.call_queue_history
FOR INSERT
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Delete
DROP POLICY IF EXISTS "Users can delete organization call queue history" ON public.call_queue_history;
CREATE POLICY "Users can delete organization call queue history"
ON public.call_queue_history
FOR DELETE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

commit;

-- Migration: 20251109043306_60b20988-a012-4ce1-bd8f-0dbaf7b57553.sql
begin;

-- 1) Corrigir dados existentes: alinhar organização da fila com a do lead
UPDATE public.call_queue cq
SET organization_id = l.organization_id
FROM public.leads l
WHERE cq.lead_id = l.id
  AND (cq.organization_id IS DISTINCT FROM l.organization_id);

UPDATE public.call_queue_history h
SET organization_id = l.organization_id
FROM public.leads l
WHERE h.lead_id = l.id
  AND (h.organization_id IS DISTINCT FROM l.organization_id);

-- 2) Garantir consistência daqui pra frente com gatilhos
CREATE OR REPLACE FUNCTION public.set_call_queue_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO v_org
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF v_org IS NOT NULL THEN
    NEW.organization_id := v_org;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_call_queue_org ON public.call_queue;
CREATE TRIGGER trg_set_call_queue_org
BEFORE INSERT OR UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_organization();

CREATE OR REPLACE FUNCTION public.set_call_queue_history_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO v_org
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF v_org IS NOT NULL THEN
    NEW.organization_id := v_org;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_call_queue_history_org ON public.call_queue_history;
CREATE TRIGGER trg_set_call_queue_history_org
BEFORE INSERT OR UPDATE ON public.call_queue_history
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_history_organization();

commit;

-- Migration: 20251109045738_d251cb80-c4db-4f35-bcf8-53c3d69539f0.sql
-- Ensure RLS and secure, consistent inserts into call_queue and call_queue_history
-- 1) Enable RLS on both tables
ALTER TABLE IF EXISTS public.call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_queue_history ENABLE ROW LEVEL SECURITY;

-- 2) Drop & recreate triggers to set organization_id and audit fields
-- call_queue triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_call_queue_set_org') THEN
    DROP TRIGGER trg_call_queue_set_org ON public.call_queue;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_call_queue_audit') THEN
    DROP TRIGGER trg_call_queue_audit ON public.call_queue;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_call_queue_update_updated_at') THEN
    DROP TRIGGER trg_call_queue_update_updated_at ON public.call_queue;
  END IF;
END $$;

CREATE TRIGGER trg_call_queue_set_org
BEFORE INSERT OR UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_organization();

CREATE TRIGGER trg_call_queue_audit
BEFORE INSERT OR UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.update_call_queue_audit();

CREATE TRIGGER trg_call_queue_update_updated_at
BEFORE UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- call_queue_history triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cq_hist_set_org') THEN
    DROP TRIGGER trg_cq_hist_set_org ON public.call_queue_history;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cq_hist_update_updated_at') THEN
    DROP TRIGGER trg_cq_hist_update_updated_at ON public.call_queue_history;
  END IF;
END $$;

CREATE TRIGGER trg_cq_hist_set_org
BEFORE INSERT OR UPDATE ON public.call_queue_history
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_history_organization();

CREATE TRIGGER trg_cq_hist_update_updated_at
BEFORE UPDATE ON public.call_queue_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Backfill missing organization_id from leads, for consistency
UPDATE public.call_queue cq
SET organization_id = l.organization_id
FROM public.leads l
WHERE cq.lead_id = l.id AND cq.organization_id IS NULL;

UPDATE public.call_queue_history cqh
SET organization_id = l.organization_id
FROM public.leads l
WHERE cqh.lead_id = l.id AND cqh.organization_id IS NULL;

-- 4) Unique constraint to avoid duplicate active queue items per lead+org
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_queue_active_by_lead_org
ON public.call_queue (lead_id, organization_id)
WHERE status IN ('pending','rescheduled');

-- 5) RLS policies: allow org members to operate; restrict updates/deletes to owner/admins or creator
-- Drop existing policies if they exist (to avoid duplicates) and recreate
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue' 
      AND policyname = 'Call queue: members can select'
  ) THEN
    DROP POLICY "Call queue: members can select" ON public.call_queue;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue' 
      AND policyname = 'Call queue: members can insert'
  ) THEN
    DROP POLICY "Call queue: members can insert" ON public.call_queue;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue' 
      AND policyname = 'Call queue: members can update own or admin'
  ) THEN
    DROP POLICY "Call queue: members can update own or admin" ON public.call_queue;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue' 
      AND policyname = 'Call queue: members can delete own or admin'
  ) THEN
    DROP POLICY "Call queue: members can delete own or admin" ON public.call_queue;
  END IF;
END $$;

-- SELECT for org members
DROP POLICY IF EXISTS "Call queue: members can select" ON public.call_queue;
CREATE POLICY "Call queue: members can select" ON public.call_queue
CREATE POLICY "Call queue: members can select" ON public.call_queue
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
  OR public.is_pubdigital_user(auth.uid())
);

-- INSERT restricted to org members; row after BEFORE triggers must satisfy created_by = auth.uid()
DROP POLICY IF EXISTS "Call queue: members can insert" ON public.call_queue;
CREATE POLICY "Call queue: members can insert" ON public.call_queue
CREATE POLICY "Call queue: members can insert" ON public.call_queue
FOR INSERT
WITH CHECK (
  (created_by = auth.uid()) AND (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = call_queue.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
);

-- UPDATE allowed to creator or admins within same org
DROP POLICY IF EXISTS "Call queue: members can update own or admin" ON public.call_queue;
CREATE POLICY "Call queue: members can update own or admin" ON public.call_queue
CREATE POLICY "Call queue: members can update own or admin" ON public.call_queue
FOR UPDATE
USING (
  (
    created_by = auth.uid()
    OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  (
    created_by = auth.uid()
    OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
);

-- DELETE allowed to creator or admins within same org
DROP POLICY IF EXISTS "Call queue: members can delete own or admin" ON public.call_queue;
CREATE POLICY "Call queue: members can delete own or admin" ON public.call_queue
CREATE POLICY "Call queue: members can delete own or admin" ON public.call_queue
FOR DELETE
USING (
  (
    created_by = auth.uid()
    OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policies for call_queue_history (read/insert by org members)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue_history' 
      AND policyname = 'CQ history: members can select'
  ) THEN
    DROP POLICY "CQ history: members can select" ON public.call_queue_history;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue_history' 
      AND policyname = 'CQ history: members can insert'
  ) THEN
    DROP POLICY "CQ history: members can insert" ON public.call_queue_history;
  END IF;
END $$;

DROP POLICY IF EXISTS "CQ history: members can select" ON public.call_queue_history;
CREATE POLICY "CQ history: members can select" ON public.call_queue_history
CREATE POLICY "CQ history: members can select" ON public.call_queue_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue_history.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.user_is_org_admin(auth.uid(), call_queue_history.organization_id)
  OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "CQ history: members can insert" ON public.call_queue_history;
CREATE POLICY "CQ history: members can insert" ON public.call_queue_history
CREATE POLICY "CQ history: members can insert" ON public.call_queue_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue_history.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.user_is_org_admin(auth.uid(), call_queue_history.organization_id)
  OR public.is_pubdigital_user(auth.uid())
);

-- 6) Ensure authenticated users can call the secure RPC
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure(uuid, timestamptz, text, text) TO authenticated;


-- Migration: 20251109090852_da2612d8-e270-47f7-9634-b3b8c6ee802e.sql
-- Remover função antiga com parâmetros default
DROP FUNCTION IF EXISTS public.add_to_call_queue_secure(uuid, timestamptz, text, text);

-- Recriar função sem defaults para permitir múltiplas entradas
-- mas bloquear apenas se já existe item pendente/rescheduled
CREATE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamptz,
  p_priority text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_lead_org_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Verificar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Obter organização do usuário
  v_org_id := get_user_organization(v_user_id);
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhuma organização';
  END IF;

  -- Verificar se o lead existe e obter sua organização
  SELECT organization_id INTO v_lead_org_id
  FROM leads
  WHERE id = p_lead_id AND deleted_at IS NULL;

  IF v_lead_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Verificar se o usuário pertence à organização do lead
  IF v_lead_org_id != v_org_id THEN
    RAISE EXCEPTION 'Usuário não pertence à organização do lead';
  END IF;

  -- Verificar se já existe item pendente ou reagendado para este lead
  SELECT id INTO v_existing_id
  FROM call_queue
  WHERE lead_id = p_lead_id
    AND organization_id = v_org_id
    AND status IN ('pending', 'rescheduled')
  LIMIT 1;

  -- Se já existe pendente/reagendado, retornar erro
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já está na fila com status ativo';
  END IF;

  -- Criar novo item na fila
  INSERT INTO call_queue (
    lead_id,
    organization_id,
    scheduled_for,
    priority,
    notes,
    status,
    created_by,
    updated_by
  ) VALUES (
    p_lead_id,
    v_org_id,
    p_scheduled_for,
    p_priority,
    p_notes,
    'pending',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO anon;

-- Migration: 20251109092850_c71ef485-0876-4f97-a698-a8d9f1ab021b.sql
-- Add missing updated_at to call_queue and a trigger to maintain it
ALTER TABLE public.call_queue
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create trigger to auto-update updated_at on updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_call_queue_updated_at'
  ) THEN
    CREATE TRIGGER update_call_queue_updated_at
    BEFORE UPDATE ON public.call_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Migration: 20251109093731_22ac65d3-b265-4e11-94e2-c642f563aa3f.sql
-- Relax update policies to let any org member complete calls
-- Drop restrictive update policies
DROP POLICY IF EXISTS "Call queue: members can update own or admin" ON public.call_queue;
DROP POLICY IF EXISTS "Users can update organization call queue" ON public.call_queue;

-- Create a single permissive update policy for authenticated org members or admins
CREATE POLICY "Org members can update call queue"
ON public.call_queue
FOR UPDATE
TO authenticated
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

-- Migration: 20251109094357_245061f2-eea1-4392-943e-0d8ebec8fbb2.sql
-- Recriar função add_to_call_queue_secure com validação corrigida
DROP FUNCTION IF EXISTS public.add_to_call_queue_secure(uuid, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamptz,
  p_priority text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_org_id uuid;
  v_lead_org_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Verificar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Obter organização do usuário
  SELECT organization_id INTO v_user_org_id
  FROM organization_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_user_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a nenhuma organização';
  END IF;

  -- Obter organização do lead
  SELECT organization_id INTO v_lead_org_id
  FROM leads
  WHERE id = p_lead_id AND deleted_at IS NULL;

  IF v_lead_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Verificar se AMBOS pertencem à MESMA organização
  IF v_lead_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'Lead pertence a organização diferente (lead: %, usuário: %)', v_lead_org_id, v_user_org_id;
  END IF;

  -- Verificar se já existe item pendente ou reagendado para este lead nesta organização
  SELECT id INTO v_existing_id
  FROM call_queue
  WHERE lead_id = p_lead_id
    AND organization_id = v_lead_org_id
    AND status IN ('pending', 'rescheduled')
  LIMIT 1;

  -- Se já existe pendente/reagendado, retornar erro
  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já está na fila com status ativo';
  END IF;

  -- Criar novo item na fila
  INSERT INTO call_queue (
    lead_id,
    organization_id,
    scheduled_for,
    priority,
    notes,
    status,
    created_by,
    updated_by
  ) VALUES (
    p_lead_id,
    v_lead_org_id,
    p_scheduled_for,
    p_priority,
    p_notes,
    'pending',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO anon;

-- Migration: 20251109094858_196bb23e-b464-4816-9158-2e2e99965f6b.sql
-- Fix add_to_call_queue_secure to use the lead's organization and validate membership correctly
DROP FUNCTION IF EXISTS public.add_to_call_queue_secure(uuid, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.add_to_call_queue_secure(
  p_lead_id uuid,
  p_scheduled_for timestamptz,
  p_priority text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_lead_org_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Fetch lead organization
  SELECT organization_id INTO v_lead_org_id
  FROM leads
  WHERE id = p_lead_id AND deleted_at IS NULL;

  IF v_lead_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  -- Validate that the user can act on the lead's organization
  IF NOT (
    public.user_belongs_to_org(v_user_id, v_lead_org_id)
    OR public.has_role(v_user_id, 'admin'::app_role)
    OR public.is_pubdigital_user(v_user_id)
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização do lead';
  END IF;

  -- Prevent duplicates (pending/rescheduled) scoped to the same organization
  SELECT id INTO v_existing_id
  FROM call_queue
  WHERE lead_id = p_lead_id
    AND organization_id = v_lead_org_id
    AND status IN ('pending', 'rescheduled')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já está na fila com status ativo';
  END IF;

  -- Insert with the lead's organization_id
  INSERT INTO call_queue (
    lead_id,
    organization_id,
    scheduled_for,
    priority,
    notes,
    status,
    created_by,
    updated_by
  ) VALUES (
    p_lead_id,
    v_lead_org_id,
    p_scheduled_for,
    p_priority,
    p_notes,
    'pending',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure TO anon;

-- Migration: 20251109101845_a86ce3d1-2d31-4a28-905a-80a3f5459094.sql
-- Habilitar REPLICA IDENTITY FULL para call_queue (necessário para realtime completo)
ALTER TABLE public.call_queue REPLICA IDENTITY FULL;

-- Migration: 20251109102630_d286c858-371c-497b-a904-5cb4f60bfcb4.sql
-- Permitir exclusão de evolution_config sem comprometer outras tabelas
-- Remover constraints antigos e recriar com CASCADE/SET NULL

-- Leads: ao deletar uma instância, apenas limpar a referência (SET NULL)
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_source_instance_id_fkey;

ALTER TABLE public.leads
ADD CONSTRAINT leads_source_instance_id_fkey 
FOREIGN KEY (source_instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE SET NULL;

-- Broadcast campaigns: ao deletar uma instância, também deletar as campanhas relacionadas (CASCADE)
ALTER TABLE public.broadcast_campaigns
DROP CONSTRAINT IF EXISTS broadcast_campaigns_instance_id_fkey;

ALTER TABLE public.broadcast_campaigns
ADD CONSTRAINT broadcast_campaigns_instance_id_fkey 
FOREIGN KEY (instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE CASCADE;

-- Scheduled messages: ao deletar uma instância, também deletar as mensagens agendadas (CASCADE)
ALTER TABLE public.scheduled_messages
DROP CONSTRAINT IF EXISTS scheduled_messages_instance_id_fkey CASCADE;

ALTER TABLE public.scheduled_messages
ADD CONSTRAINT scheduled_messages_instance_id_fkey 
FOREIGN KEY (instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE CASCADE;

-- Migration: 20251109102912_e157b906-a5b4-4d0a-9d1a-5da5edce66d0.sql
-- Reverter migration anterior
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_source_instance_id_fkey;

ALTER TABLE public.broadcast_campaigns
DROP CONSTRAINT IF EXISTS broadcast_campaigns_instance_id_fkey;

ALTER TABLE public.scheduled_messages
DROP CONSTRAINT IF EXISTS scheduled_messages_instance_id_fkey CASCADE;

-- Adicionar campos para preservar histórico do nome da instância
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS source_instance_name TEXT;

ALTER TABLE public.broadcast_campaigns
ADD COLUMN IF NOT EXISTS instance_name TEXT;

-- Criar função para preservar nome da instância antes de deletar
CREATE OR REPLACE FUNCTION preserve_instance_name_before_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar leads que usam esta instância
  UPDATE public.leads
  SET source_instance_name = OLD.instance_name
  WHERE source_instance_id = OLD.id AND source_instance_name IS NULL;
  
  -- Atualizar campanhas que usam esta instância
  UPDATE public.broadcast_campaigns
  SET instance_name = OLD.instance_name
  WHERE instance_id = OLD.id AND instance_name IS NULL;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para executar antes de deletar evolution_config
DROP TRIGGER IF EXISTS preserve_instance_name_trigger ON public.evolution_config;
CREATE TRIGGER preserve_instance_name_trigger
BEFORE DELETE ON public.evolution_config
FOR EACH ROW
EXECUTE FUNCTION preserve_instance_name_before_delete();

-- Recriar constraints com SET NULL (agora com histórico preservado)
ALTER TABLE public.leads
ADD CONSTRAINT leads_source_instance_id_fkey 
FOREIGN KEY (source_instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE SET NULL;

ALTER TABLE public.broadcast_campaigns
ADD CONSTRAINT broadcast_campaigns_instance_id_fkey 
FOREIGN KEY (instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE SET NULL;

-- Scheduled messages: CASCADE pois dependem da instância existir para enviar
ALTER TABLE public.scheduled_messages
ADD CONSTRAINT scheduled_messages_instance_id_fkey 
FOREIGN KEY (instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE CASCADE;

-- Migration: 20251109103600_6b86be89-653f-4485-8fe0-5eb9e4891f25.sql
-- Corrigir RLS para permitir exclusão por organização (múltiplas orgs)
DROP POLICY IF EXISTS "Users can delete organization config" ON public.evolution_config;

CREATE POLICY "Users can delete organization config"
ON public.evolution_config
FOR DELETE
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Migration: 20251109103852_df8ec88f-c69a-44a9-829a-7aee9e0abe86.sql
-- Tornar instance_id nullable em broadcast_campaigns para permitir exclusão com histórico
ALTER TABLE public.broadcast_campaigns
ALTER COLUMN instance_id DROP NOT NULL;

-- Verificar se há campanhas sem instance_id e preencher com o nome preservado
UPDATE public.broadcast_campaigns
SET instance_name = (
  SELECT instance_name 
  FROM public.evolution_config 
  WHERE id = broadcast_campaigns.instance_id
)
WHERE instance_name IS NULL AND instance_id IS NOT NULL;

-- Migration: 20251109130030_c007ed08-1193-4689-ac90-012a4b636210.sql
-- Adicionar status 'cancelled' à constraint da tabela broadcast_queue
ALTER TABLE broadcast_queue DROP CONSTRAINT IF EXISTS valid_queue_status;

ALTER TABLE broadcast_queue ADD CONSTRAINT valid_queue_status 
CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled'));

COMMIT;

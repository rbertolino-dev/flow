-- ============================================
-- Aplicar Disparador 2 Completo
-- ============================================
-- Este arquivo aplica todas as migrations necessárias
-- na ordem correta para criar o Disparador 2
-- ============================================

-- ============================================
-- PARTE 1: Criar Tabelas (Migration Inicial)
-- ============================================

-- 1. Criar tabela broadcast_campaigns_2
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns_2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_template_id UUID REFERENCES public.message_templates(id),
  custom_message TEXT,
  instance_id UUID REFERENCES public.evolution_config(id),
  min_delay_seconds INTEGER NOT NULL DEFAULT 30,
  max_delay_seconds INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'draft',
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sending_method TEXT DEFAULT 'single',
  scheduled_start_at TIMESTAMPTZ,
  image_url TEXT,
  media_type TEXT,
  backup_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  failover_enabled BOOLEAN DEFAULT false,
  failover_mode TEXT DEFAULT 'auto' CHECK (failover_mode IN ('auto', 'manual')),
  current_active_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  last_failover_at TIMESTAMPTZ,
  failover_cooldown_until TIMESTAMPTZ,
  primary_failure_count INTEGER DEFAULT 0,
  last_health_check_at TIMESTAMPTZ,
  failover_count INTEGER DEFAULT 0,
  sending_started_at TIMESTAMPTZ,
  instance_ids UUID[],
  CONSTRAINT valid_status_2 CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled'))
);

-- 2. Criar tabela broadcast_queue_2
CREATE TABLE IF NOT EXISTS public.broadcast_queue_2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns_2(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.evolution_config(id),
  phone TEXT NOT NULL,
  name TEXT,
  personalized_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  empresa TEXT,
  nome_empresa TEXT,
  email TEXT,
  cpf TEXT,
  cnpj TEXT,
  custom_fields JSONB,
  attempted_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  send_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  deduplication_hash TEXT,
  processing_lock_until TIMESTAMPTZ,
  sending_started_at TIMESTAMPTZ,
  CONSTRAINT valid_queue_status_2 CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled'))
);

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_user_id ON public.broadcast_campaigns_2(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_org_id ON public.broadcast_campaigns_2(organization_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_status ON public.broadcast_campaigns_2(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_campaign_id ON public.broadcast_queue_2(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_status ON public.broadcast_queue_2(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_org_id ON public.broadcast_queue_2(organization_id) WHERE organization_id IS NOT NULL;

-- 4. Habilitar RLS
ALTER TABLE public.broadcast_campaigns_2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_queue_2 ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 2: Criar Políticas RLS Corretas
-- ============================================

-- Remover TODAS as políticas antigas (se existirem) - incluindo as novas
DROP POLICY IF EXISTS "Users can view their own campaigns 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can create their own campaigns 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can update their own campaigns 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can delete their own campaigns 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "broadcast_campaigns_2_delete_org_members" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can view campaigns from their org 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can create campaigns for their org 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can update campaigns from their org 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can delete campaigns from their org 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Super admins can view all broadcast_campaigns_2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can view queue of their campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can insert queue of their campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can update queue of their campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can delete queue of their campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can view queue of their org campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can insert queue of their org campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can update queue of their org campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can delete queue of their org campaigns 2" ON public.broadcast_queue_2;

-- Políticas RLS para broadcast_campaigns_2 (usando organization_id)
CREATE POLICY "Users can view campaigns from their org 2"
ON public.broadcast_campaigns_2 FOR SELECT TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create campaigns for their org 2"
ON public.broadcast_campaigns_2 FOR INSERT TO authenticated
WITH CHECK (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update campaigns from their org 2"
ON public.broadcast_campaigns_2 FOR UPDATE TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete campaigns from their org 2"
ON public.broadcast_campaigns_2 FOR DELETE TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Políticas RLS para broadcast_queue_2
CREATE POLICY "Users can view queue of their org campaigns 2"
ON public.broadcast_queue_2 FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND (
      public.user_belongs_to_org(auth.uid(), broadcast_campaigns_2.organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
);

CREATE POLICY "Users can insert queue of their org campaigns 2"
ON public.broadcast_queue_2 FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND (
      public.user_belongs_to_org(auth.uid(), broadcast_campaigns_2.organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
);

CREATE POLICY "Users can update queue of their org campaigns 2"
ON public.broadcast_queue_2 FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND (
      public.user_belongs_to_org(auth.uid(), broadcast_campaigns_2.organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
);

CREATE POLICY "Users can delete queue of their org campaigns 2"
ON public.broadcast_queue_2 FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND (
      public.user_belongs_to_org(auth.uid(), broadcast_campaigns_2.organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
);

-- Super admins podem ver tudo
CREATE POLICY "Super admins can view all broadcast_campaigns_2"
ON public.broadcast_campaigns_2 FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = broadcast_campaigns_2.organization_id
    AND organizations.name = 'PubDigital'
  )
);

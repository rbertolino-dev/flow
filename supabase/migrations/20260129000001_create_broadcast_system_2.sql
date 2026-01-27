-- ============================================
-- Sistema de Disparador 2 - 100% Separado
-- ============================================
-- Cria cópia exata do sistema de disparador atual
-- Tabelas: broadcast_campaigns_2 e broadcast_queue_2
-- Edge Function: process-broadcast-queue-2
-- ============================================

-- 1. Criar tabela broadcast_campaigns_2 (cópia exata de broadcast_campaigns)
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
  
  -- Campos adicionados nas migrations posteriores
  sending_method TEXT DEFAULT 'single',
  scheduled_start_at TIMESTAMPTZ,
  image_url TEXT,
  media_type TEXT,
  
  -- Campos de failover
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
  
  -- Campos para múltiplas instâncias
  instance_ids UUID[],
  
  CONSTRAINT valid_status_2 CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled'))
);

-- 2. Criar tabela broadcast_queue_2 (cópia exata de broadcast_queue)
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
  
  -- Campos dinâmicos
  empresa TEXT,
  nome_empresa TEXT,
  email TEXT,
  cpf TEXT,
  cnpj TEXT,
  custom_fields JSONB,
  
  -- Campos de rastreamento e failover
  attempted_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  send_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  deduplication_hash TEXT,
  processing_lock_until TIMESTAMPTZ,
  sending_started_at TIMESTAMPTZ,
  
  CONSTRAINT valid_queue_status_2 CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled'))
);

-- 3. Criar índices para broadcast_campaigns_2
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_user_id 
  ON public.broadcast_campaigns_2(user_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_org_id 
  ON public.broadcast_campaigns_2(organization_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_status 
  ON public.broadcast_campaigns_2(status);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_scheduled_start 
  ON public.broadcast_campaigns_2(scheduled_start_at) 
  WHERE scheduled_start_at IS NOT NULL AND status = 'draft';

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_active_instance 
  ON public.broadcast_campaigns_2(current_active_instance_id) 
  WHERE current_active_instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_2_failover_enabled 
  ON public.broadcast_campaigns_2(failover_enabled, status) 
  WHERE failover_enabled = true AND status = 'running';

-- 4. Criar índices para broadcast_queue_2
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_campaign_id 
  ON public.broadcast_queue_2(campaign_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_status 
  ON public.broadcast_queue_2(status);

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_scheduled_for 
  ON public.broadcast_queue_2(scheduled_for) 
  WHERE scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_org_id 
  ON public.broadcast_queue_2(organization_id) 
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_phone 
  ON public.broadcast_queue_2(phone);

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_empresa 
  ON public.broadcast_queue_2(empresa) 
  WHERE empresa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_nome_empresa 
  ON public.broadcast_queue_2(nome_empresa) 
  WHERE nome_empresa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_email 
  ON public.broadcast_queue_2(email) 
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_deduplication 
  ON public.broadcast_queue_2(deduplication_hash) 
  WHERE deduplication_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_processing_lock 
  ON public.broadcast_queue_2(processing_lock_until) 
  WHERE processing_lock_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_2_attempted_instance 
  ON public.broadcast_queue_2(attempted_instance_id) 
  WHERE attempted_instance_id IS NOT NULL;

-- 5. Índice único para prevenir duplicatas (campaign_id + phone)
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_queue_2_unique_campaign_phone 
  ON public.broadcast_queue_2(campaign_id, phone) 
  WHERE status IN ('pending', 'scheduled');

-- 6. Habilitar RLS
ALTER TABLE public.broadcast_campaigns_2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_queue_2 ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para broadcast_campaigns_2
CREATE POLICY "Users can view their own campaigns 2"
ON public.broadcast_campaigns_2 FOR SELECT
USING (auth.uid() = user_id);

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

CREATE POLICY "Users can create their own campaigns 2"
ON public.broadcast_campaigns_2 FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns 2"
ON public.broadcast_campaigns_2 FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns 2"
ON public.broadcast_campaigns_2 FOR DELETE
USING (auth.uid() = user_id);

-- Política adicional para DELETE: Membros da organização podem deletar campanhas da sua organização (igual ao original)
CREATE POLICY "broadcast_campaigns_2_delete_org_members"
ON public.broadcast_campaigns_2 FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = broadcast_campaigns_2.organization_id
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 8. Políticas RLS para broadcast_queue_2
CREATE POLICY "Users can view queue of their campaigns 2"
ON public.broadcast_queue_2 FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND broadcast_campaigns_2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert queue of their campaigns 2"
ON public.broadcast_queue_2 FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND broadcast_campaigns_2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update queue of their campaigns 2"
ON public.broadcast_queue_2 FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND broadcast_campaigns_2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete queue of their campaigns 2"
ON public.broadcast_queue_2 FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND broadcast_campaigns_2.user_id = auth.uid()
  )
);

-- 9. Comentários para documentação
COMMENT ON TABLE public.broadcast_campaigns_2 IS 'Sistema de disparador 2 - 100% separado do sistema original';
COMMENT ON TABLE public.broadcast_queue_2 IS 'Fila de envio do sistema de disparador 2 - 100% separado do sistema original';

COMMENT ON COLUMN public.broadcast_campaigns_2.sending_method IS 'Método de envio: single (uma instância), rotate (rotacionar entre instâncias), separate (disparar separadamente)';
COMMENT ON COLUMN public.broadcast_campaigns_2.scheduled_start_at IS 'Data e hora agendada para início automático da campanha';
COMMENT ON COLUMN public.broadcast_campaigns_2.image_url IS 'URL da imagem a ser enviada com a campanha (opcional)';
COMMENT ON COLUMN public.broadcast_campaigns_2.media_type IS 'Tipo de mídia: image, video, document (opcional)';

COMMENT ON COLUMN public.broadcast_queue_2.empresa IS 'Nome curto da empresa (usado em tags dinâmicas {empresa})';
COMMENT ON COLUMN public.broadcast_queue_2.nome_empresa IS 'Nome completo/razão social da empresa (usado em tags dinâmicas {nome_empresa})';
COMMENT ON COLUMN public.broadcast_queue_2.email IS 'Email do contato (usado em tags dinâmicas {email})';
COMMENT ON COLUMN public.broadcast_queue_2.cpf IS 'CPF do contato (usado em tags dinâmicas {cpf})';
COMMENT ON COLUMN public.broadcast_queue_2.cnpj IS 'CNPJ da empresa (usado em tags dinâmicas {cnpj})';
COMMENT ON COLUMN public.broadcast_queue_2.custom_fields IS 'Campos customizados adicionais do CSV em formato JSON (usado em tags dinâmicas)';
COMMENT ON COLUMN public.broadcast_queue_2.deduplication_hash IS 'Hash único para prevenir mensagens duplicadas';
COMMENT ON COLUMN public.broadcast_queue_2.processing_lock_until IS 'Lock para evitar processamento concorrente por múltiplos workers';

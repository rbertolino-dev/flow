-- ============================================
-- Sistema de Failover para Disparo em Massa
-- ============================================
-- Adiciona suporte a failover automático e manual
-- entre instância PRIMARY e BACKUP
-- ============================================

-- 1. Adicionar campos de failover em broadcast_campaigns
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS backup_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failover_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS failover_mode TEXT DEFAULT 'auto' CHECK (failover_mode IN ('auto', 'manual')),
  ADD COLUMN IF NOT EXISTS current_active_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_failover_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failover_cooldown_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primary_failure_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failover_count INTEGER DEFAULT 0; -- Contador de trocas para cooldown progressivo

-- 2. Criar tabela de logs de failover
CREATE TABLE IF NOT EXISTS public.broadcast_failover_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Detalhes da troca
  from_instance_id UUID NOT NULL REFERENCES public.evolution_config(id),
  to_instance_id UUID NOT NULL REFERENCES public.evolution_config(id),
  failover_type TEXT NOT NULL CHECK (failover_type IN ('auto', 'manual')),
  triggered_by_user_id UUID REFERENCES auth.users(id), -- NULL se automático
  
  -- Motivo da troca
  reason TEXT NOT NULL, -- 'health_check_failed', 'manual_switch', 'timeout', 'error_rate', etc.
  failure_details JSONB, -- Detalhes técnicos (códigos HTTP, mensagens de erro, etc.)
  
  -- Estado da campanha no momento da troca
  queue_items_pending INTEGER DEFAULT 0,
  queue_items_sending INTEGER DEFAULT 0,
  queue_items_sent INTEGER DEFAULT 0,
  queue_items_failed INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadados
  metadata JSONB -- Informações adicionais (IP, user agent, etc.)
);

-- 3. Adicionar campos de rastreamento em broadcast_queue
ALTER TABLE public.broadcast_queue
  ADD COLUMN IF NOT EXISTS attempted_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS send_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deduplication_hash TEXT,
  ADD COLUMN IF NOT EXISTS processing_lock_until TIMESTAMPTZ;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_active_instance 
  ON public.broadcast_campaigns(current_active_instance_id) 
  WHERE current_active_instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_failover_enabled 
  ON public.broadcast_campaigns(failover_enabled, status) 
  WHERE failover_enabled = true AND status = 'running';

CREATE INDEX IF NOT EXISTS idx_broadcast_failover_logs_campaign 
  ON public.broadcast_failover_logs(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_deduplication 
  ON public.broadcast_queue(deduplication_hash) 
  WHERE deduplication_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_processing_lock 
  ON public.broadcast_queue(processing_lock_until) 
  WHERE processing_lock_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_attempted_instance 
  ON public.broadcast_queue(attempted_instance_id) 
  WHERE attempted_instance_id IS NOT NULL;

-- 5. Habilitar RLS na nova tabela
ALTER TABLE public.broadcast_failover_logs ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para broadcast_failover_logs
CREATE POLICY "Users can view failover logs of their campaigns"
ON public.broadcast_failover_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns
    WHERE broadcast_campaigns.id = broadcast_failover_logs.campaign_id
    AND broadcast_campaigns.user_id = auth.uid()
  )
);

-- 7. Função para calcular cooldown progressivo
CREATE OR REPLACE FUNCTION public.calculate_failover_cooldown(failover_count INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE
    WHEN failover_count = 0 THEN RETURN 5; -- 5 minutos
    WHEN failover_count = 1 THEN RETURN 5; -- 5 minutos
    WHEN failover_count = 2 THEN RETURN 10; -- 10 minutos
    WHEN failover_count >= 3 AND failover_count < 5 THEN RETURN 15; -- 15 minutos
    ELSE RETURN 30; -- 30 minutos para 5+ trocas
  END CASE;
END;
$$;

-- 8. Função para verificar se pode voltar para PRIMARY
CREATE OR REPLACE FUNCTION public.can_return_to_primary(
  p_campaign_id UUID,
  p_primary_instance_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign RECORD;
  v_cooldown_minutes INTEGER;
  v_primary_healthy BOOLEAN;
BEGIN
  -- Buscar dados da campanha
  SELECT 
    failover_cooldown_until,
    failover_count,
    current_active_instance_id
  INTO v_campaign
  FROM public.broadcast_campaigns
  WHERE id = p_campaign_id;

  -- Se não está usando BACKUP, não precisa voltar
  IF v_campaign.current_active_instance_id = p_primary_instance_id THEN
    RETURN false;
  END IF;

  -- Verificar se cooldown expirou
  IF v_campaign.failover_cooldown_until IS NOT NULL 
     AND v_campaign.failover_cooldown_until > now() THEN
    RETURN false;
  END IF;

  -- Verificar se PRIMARY está saudável
  SELECT is_connected INTO v_primary_healthy
  FROM public.evolution_config
  WHERE id = p_primary_instance_id;

  IF NOT v_primary_healthy THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 9. Comentários para documentação
COMMENT ON COLUMN public.broadcast_campaigns.backup_instance_id IS 'Instância de backup para failover';
COMMENT ON COLUMN public.broadcast_campaigns.failover_enabled IS 'Habilita failover automático para esta campanha';
COMMENT ON COLUMN public.broadcast_campaigns.failover_mode IS 'Modo de failover: auto (automático) ou manual';
COMMENT ON COLUMN public.broadcast_campaigns.current_active_instance_id IS 'Instância atualmente ativa (pode ser diferente de instance_id após failover)';
COMMENT ON COLUMN public.broadcast_campaigns.failover_cooldown_until IS 'Timestamp até quando não deve voltar para PRIMARY (evita flapping)';
COMMENT ON COLUMN public.broadcast_queue.deduplication_hash IS 'Hash único para prevenir mensagens duplicadas (SHA256 de campaign_id + phone + message)';
COMMENT ON COLUMN public.broadcast_queue.processing_lock_until IS 'Lock para evitar processamento concorrente por múltiplos workers';



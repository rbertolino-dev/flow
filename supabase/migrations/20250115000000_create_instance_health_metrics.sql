-- ============================================================================
-- TABELA DE MÉTRICAS DE SAÚDE DE INSTÂNCIAS (OTIMIZADA)
-- ============================================================================
-- Esta tabela armazena métricas agregadas por hora para reduzir custos
-- Em vez de 1 registro por mensagem, temos 1 registro por hora por instância
-- Reduz writes em ~99% comparado a abordagem não otimizada
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.instance_health_metrics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
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

-- Usuários podem ver métricas de suas instâncias
CREATE POLICY "Users can view metrics of their instances"
  ON public.instance_health_metrics_hourly
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.evolution_config ec
      WHERE ec.id = instance_health_metrics_hourly.instance_id
        AND ec.organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid()
        )
    )
  );

-- Edge functions podem inserir/atualizar (service role)
CREATE POLICY "Service role can manage metrics"
  ON public.instance_health_metrics_hourly
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_instance_health_metrics_updated_at
  BEFORE UPDATE ON public.instance_health_metrics_hourly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.instance_health_metrics_hourly IS 'Métricas de saúde agregadas por hora para reduzir custos de storage e writes';
COMMENT ON COLUMN public.instance_health_metrics_hourly.hour_bucket IS 'Timestamp truncado para hora (ex: 2025-01-15 10:00:00)';
COMMENT ON COLUMN public.instance_health_metrics_hourly.http_429_count IS 'Contador de rate limits detectados (HTTP 429)';
COMMENT ON COLUMN public.instance_health_metrics_hourly.consecutive_failures_max IS 'Máximo de falhas consecutivas no período de 1 hora';


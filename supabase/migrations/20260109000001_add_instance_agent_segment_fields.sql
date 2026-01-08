-- Migration: Adicionar campos de agente reserva, diretriz, limites e segmento na tabela evolution_config
-- Data: 2026-01-09

-- Adicionar colunas para gerenciamento de agentes e segmentos
ALTER TABLE public.evolution_config
  ADD COLUMN IF NOT EXISTS reserve_agent_name TEXT,
  ADD COLUMN IF NOT EXISTS guideline TEXT DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS daily_dispatch_limit INTEGER,
  ADD COLUMN IF NOT EXISTS total_dispatch_limit INTEGER,
  ADD COLUMN IF NOT EXISTS segment TEXT,
  ADD COLUMN IF NOT EXISTS segment_start_date DATE,
  ADD COLUMN IF NOT EXISTS segment_end_date DATE,
  ADD COLUMN IF NOT EXISTS is_titular BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.evolution_config.reserve_agent_name IS 'Nome do agente reserva (backup) da instância';
COMMENT ON COLUMN public.evolution_config.guideline IS 'Diretriz da instância (editável)';
COMMENT ON COLUMN public.evolution_config.daily_dispatch_limit IS 'Limite de disparos por dia';
COMMENT ON COLUMN public.evolution_config.total_dispatch_limit IS 'Total de limite de disparo';
COMMENT ON COLUMN public.evolution_config.segment IS 'Segmento da instância (Monitoramento e alarmes, Assistência técnica - Brasil, Provedor - Brasil, LATAM CAPPI - Provedor)';
COMMENT ON COLUMN public.evolution_config.segment_start_date IS 'Data de início do período em que o segmento está atuando';
COMMENT ON COLUMN public.evolution_config.segment_end_date IS 'Data de fim do período em que o segmento está atuando';
COMMENT ON COLUMN public.evolution_config.is_titular IS 'Indica se a instância é titular (true) ou reserva (false)';

-- Criar índice para busca por segmento
CREATE INDEX IF NOT EXISTS idx_evolution_config_segment ON public.evolution_config(segment) WHERE segment IS NOT NULL;

-- Criar índice para busca por agente reserva
CREATE INDEX IF NOT EXISTS idx_evolution_config_reserve_agent ON public.evolution_config(reserve_agent_name) WHERE reserve_agent_name IS NOT NULL;


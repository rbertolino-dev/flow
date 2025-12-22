-- Migration: Adicionar coluna period_type em seller_goals
-- Data: 2025-01-26
-- Descrição: Adiciona coluna period_type e migra dados de goal_type se necessário

-- Adicionar coluna period_type se não existir
ALTER TABLE public.seller_goals 
  ADD COLUMN IF NOT EXISTS period_type TEXT CHECK (period_type IN ('monthly', 'weekly', 'quarterly', 'yearly'));

-- Adicionar colunas de target se não existirem
ALTER TABLE public.seller_goals 
  ADD COLUMN IF NOT EXISTS target_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_value DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_commission DECIMAL(10, 2) DEFAULT 0;

-- Migrar dados: se period_type for NULL e goal_type existir, tentar inferir
DO $$
BEGIN
  -- Se houver registros com goal_type mas sem period_type, migrar
  UPDATE public.seller_goals
  SET period_type = CASE 
    WHEN period_type IS NULL THEN 'monthly' -- Default para monthly
    ELSE period_type
  END
  WHERE period_type IS NULL;
  
  -- Se houver target_value mas target_leads/target_commission forem NULL, copiar
  UPDATE public.seller_goals
  SET target_value = COALESCE(target_value, 0)
  WHERE target_value IS NULL;
  
  UPDATE public.seller_goals
  SET target_leads = COALESCE(target_leads, 0)
  WHERE target_leads IS NULL;
  
  UPDATE public.seller_goals
  SET target_commission = COALESCE(target_commission, 0)
  WHERE target_commission IS NULL;
END $$;

-- Tornar period_type NOT NULL após migração
ALTER TABLE public.seller_goals 
  ALTER COLUMN period_type SET NOT NULL,
  ALTER COLUMN period_type SET DEFAULT 'monthly';

-- Atualizar constraint UNIQUE para incluir period_type
ALTER TABLE public.seller_goals 
  DROP CONSTRAINT IF EXISTS seller_goals_organization_id_user_id_period_start_period_end_goal_type_key;

ALTER TABLE public.seller_goals 
  ADD CONSTRAINT seller_goals_organization_id_user_id_period_type_period_start_key 
  UNIQUE(organization_id, user_id, period_type, period_start);

-- Criar índice para period_type se não existir
CREATE INDEX IF NOT EXISTS idx_seller_goals_period_type 
  ON public.seller_goals(period_type, period_start, period_end);

-- Comentários
COMMENT ON COLUMN public.seller_goals.period_type IS 'Tipo de período: monthly, weekly, quarterly, yearly';
COMMENT ON COLUMN public.seller_goals.target_leads IS 'Meta de quantidade de leads ganhos';
COMMENT ON COLUMN public.seller_goals.target_value IS 'Meta de valor total em vendas';
COMMENT ON COLUMN public.seller_goals.target_commission IS 'Meta de comissão total';


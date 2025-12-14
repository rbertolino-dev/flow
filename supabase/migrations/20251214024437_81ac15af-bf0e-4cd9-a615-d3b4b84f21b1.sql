-- Adicionar colunas faltantes na tabela cloud_cost_config
ALTER TABLE public.cloud_cost_config 
  ADD COLUMN IF NOT EXISTS cost_per_workflow_execution NUMERIC DEFAULT 0.00001,
  ADD COLUMN IF NOT EXISTS cost_per_form_submission NUMERIC DEFAULT 0.00001,
  ADD COLUMN IF NOT EXISTS cost_per_agent_ai_call NUMERIC DEFAULT 0.0001;
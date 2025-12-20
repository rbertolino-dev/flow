-- Adicionar novos campos de custo em cloud_cost_config
ALTER TABLE public.cloud_cost_config
ADD COLUMN IF NOT EXISTS cost_per_workflow_execution NUMERIC(10, 6) DEFAULT 0.0001,
ADD COLUMN IF NOT EXISTS cost_per_form_submission NUMERIC(10, 6) DEFAULT 0.0001,
ADD COLUMN IF NOT EXISTS cost_per_agent_ai_call NUMERIC(10, 6) DEFAULT 0.001;

-- Comentários para documentação
COMMENT ON COLUMN public.cloud_cost_config.cost_per_workflow_execution IS 'Custo por execução de workflow periódico (edge function + database operations)';
COMMENT ON COLUMN public.cloud_cost_config.cost_per_form_submission IS 'Custo por submissão de formulário (edge function call + database write)';
COMMENT ON COLUMN public.cloud_cost_config.cost_per_agent_ai_call IS 'Custo por chamada de assistente IA (edge function + API OpenAI/DeepSeek)';


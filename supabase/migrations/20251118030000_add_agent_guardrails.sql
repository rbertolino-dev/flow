-- Adicionar campos guardrails e few_shot_examples na tabela agents
-- Esses campos são usados para melhorar a precisão e evitar erros dos agentes IA
-- CUSTO: ZERO (apenas schema, sem impacto em queries)

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS guardrails text,
  ADD COLUMN IF NOT EXISTS few_shot_examples text;

COMMENT ON COLUMN public.agents.guardrails IS 
  'Regras obrigatórias que o agente DEVE seguir sempre (ex: NUNCA invente preços, SEMPRE escale se cliente insatisfeito)';

COMMENT ON COLUMN public.agents.few_shot_examples IS 
  'Exemplos de perguntas e respostas ideais para treinar o agente (Few-Shot Learning)';


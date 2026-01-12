-- Migration: Adicionar campo approved na tabela budgets
-- Data: 2026-01-10

-- Adicionar coluna approved (boolean)
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;

-- Criar índice para performance em queries de orçamentos aprovados
CREATE INDEX IF NOT EXISTS idx_budgets_approved ON public.budgets(organization_id, approved) WHERE approved = true;

-- Comentário para documentação
COMMENT ON COLUMN public.budgets.approved IS 'Indica se o orçamento foi aprovado pelo cliente';

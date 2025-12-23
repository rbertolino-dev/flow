-- Migration: Adicionar campos de personalização ao PDF de orçamento
-- Data: 2025-12-18

-- Adicionar coluna para cor da barra superior
ALTER TABLE public.budgets 
ADD COLUMN IF NOT EXISTS header_color TEXT;

-- Adicionar coluna para URL do logo/imagem no cabeçalho
ALTER TABLE public.budgets 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.budgets.header_color IS 'Cor hexadecimal da barra superior do PDF (ex: #3b82f6)';
COMMENT ON COLUMN public.budgets.logo_url IS 'URL da imagem/logo a ser exibida no cabeçalho do PDF';














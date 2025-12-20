-- ============================================================
-- APLICAR MIGRATION: Personalização de Orçamentos
-- ============================================================
-- Este SQL adiciona os campos header_color e logo_url à tabela budgets
-- para permitir personalização do PDF de orçamentos
--
-- INSTRUÇÕES:
-- 1. Acesse: https://supabase.com/dashboard
-- 2. Selecione seu projeto
-- 3. Vá em "SQL Editor" (menu lateral)
-- 4. Cole este SQL completo
-- 5. Clique em "Run" para executar
-- ============================================================

-- Adicionar coluna para cor da barra superior
ALTER TABLE public.budgets 
ADD COLUMN IF NOT EXISTS header_color TEXT;

-- Adicionar coluna para URL do logo/imagem no cabeçalho
ALTER TABLE public.budgets 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.budgets.header_color IS 'Cor hexadecimal da barra superior do PDF (ex: #3b82f6)';
COMMENT ON COLUMN public.budgets.logo_url IS 'URL da imagem/logo a ser exibida no cabeçalho do PDF';

-- ============================================================
-- VERIFICAÇÃO (opcional - execute para verificar se funcionou)
-- ============================================================
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'budgets'
--   AND column_name IN ('header_color', 'logo_url');
-- ============================================================














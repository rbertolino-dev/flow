-- ============================================
-- MIGRAÇÕES: Sistema de Contratos Completo
-- ============================================
-- Execute estas migrações no Supabase SQL Editor
-- 
-- Inclui:
-- 1. Folha de rosto nos templates
-- 2. Token de assinatura para acesso público
-- ============================================

-- ============================================
-- MIGRAÇÃO 1: Adicionar Folha de Rosto
-- ============================================
ALTER TABLE public.contract_templates
ADD COLUMN IF NOT EXISTS cover_page_url TEXT;

COMMENT ON COLUMN public.contract_templates.cover_page_url IS 'URL da imagem de folha de rosto (fundo) que será usada no PDF. Deve ter exatamente 210x297mm (A4) para encaixar 100%.';

-- ============================================
-- MIGRAÇÃO 2: Token de Assinatura
-- ============================================
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS signature_token TEXT;

-- Criar índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_contracts_signature_token 
ON public.contracts(signature_token) 
WHERE signature_token IS NOT NULL;

-- Função para gerar token único de assinatura
CREATE OR REPLACE FUNCTION public.generate_contract_signature_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  -- Gerar token aleatório seguro (32 caracteres hexadecimais)
  token := encode(gen_random_bytes(16), 'hex');
  RETURN token;
END;
$$;

COMMENT ON COLUMN public.contracts.signature_token IS 'Token único para acesso público à página de assinatura. Gerado automaticamente quando o contrato é enviado.';
COMMENT ON FUNCTION public.generate_contract_signature_token() IS 'Gera um token único e seguro para acesso à página de assinatura do contrato.';

-- ============================================
-- FIM DAS MIGRAÇÕES
-- ============================================
-- 
-- Após executar:
-- 1. Verifique se as colunas foram criadas
-- 2. Faça o deploy do frontend
-- 3. Teste criando um contrato com folha de rosto
-- 4. Teste enviando via WhatsApp e assinando pelo link
-- ============================================



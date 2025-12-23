-- Adicionar campos de autenticação e validação na tabela contract_signatures
-- Seguindo diretrizes: usar IF NOT EXISTS e não quebrar funcionalidades existentes

-- Adicionar coluna user_agent (navegador/dispositivo usado)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Adicionar coluna device_info (informações do dispositivo em JSON)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS device_info JSONB;

-- Adicionar coluna geolocation (localização aproximada, opcional)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS geolocation JSONB;

-- Adicionar coluna validation_hash (hash SHA-256 para validação de integridade)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS validation_hash TEXT;

-- Adicionar coluna signed_ip_country (país do IP, opcional)
ALTER TABLE public.contract_signatures
ADD COLUMN IF NOT EXISTS signed_ip_country TEXT;

-- Criar índice para validation_hash para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_contract_signatures_validation_hash 
ON public.contract_signatures(validation_hash);

-- Comentários para documentação
COMMENT ON COLUMN public.contract_signatures.user_agent IS 'User Agent do navegador/dispositivo usado para assinar';
COMMENT ON COLUMN public.contract_signatures.device_info IS 'Informações adicionais do dispositivo em formato JSON';
COMMENT ON COLUMN public.contract_signatures.geolocation IS 'Localização aproximada do signatário (com consentimento)';
COMMENT ON COLUMN public.contract_signatures.validation_hash IS 'Hash SHA-256 para validação de integridade da assinatura';
COMMENT ON COLUMN public.contract_signatures.signed_ip_country IS 'País do IP de origem da assinatura';


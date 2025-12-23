-- Adicionar token de assinatura para acesso público seguro
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

-- Comentário
COMMENT ON COLUMN public.contracts.signature_token IS 'Token único para acesso público à página de assinatura. Gerado automaticamente quando o contrato é enviado.';
COMMENT ON FUNCTION public.generate_contract_signature_token() IS 'Gera um token único e seguro para acesso à página de assinatura do contrato.';



-- Adicionar campos de endereço, redes sociais e frase de efeito na tabela organizations
-- Estes campos serão usados nos orçamentos e documentos da organização

-- Endereço completo da organização
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS address TEXT;

-- Redes sociais (JSONB para armazenar múltiplas redes)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}'::jsonb;

-- Frase de efeito curta (tagline)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS tagline TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.organizations.address IS 'Endereço completo da organização (rua, número, bairro, CEP, etc.)';
COMMENT ON COLUMN public.organizations.social_media IS 'Redes sociais da organização em formato JSON: {"instagram": "url", "facebook": "url", "linkedin": "url", "twitter": "url", "youtube": "url", "website": "url"}';
COMMENT ON COLUMN public.organizations.tagline IS 'Frase de efeito curta da organização (máximo 150 caracteres)';


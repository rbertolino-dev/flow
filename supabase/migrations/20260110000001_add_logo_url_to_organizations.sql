-- Adicionar coluna logo_url na tabela organizations
-- Esta coluna armazena a URL da logo da empresa que será usada nos orçamentos

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.organizations.logo_url IS 'URL da logo da empresa armazenada no Supabase Storage. Usada nos orçamentos e documentos da organização.';


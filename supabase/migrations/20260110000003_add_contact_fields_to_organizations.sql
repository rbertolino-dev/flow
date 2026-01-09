-- Adicionar campos de contato na tabela organizations
-- Estes campos serão usados nos orçamentos e documentos da organização

-- CNPJ da organização
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- Telefone de contato da organização
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Email de contato da organização
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.organizations.cnpj IS 'CNPJ da organização (formato: XX.XXX.XXX/XXXX-XX ou apenas números)';
COMMENT ON COLUMN public.organizations.phone IS 'Telefone de contato da organização (formato: (XX) XXXXX-XXXX ou apenas números)';
COMMENT ON COLUMN public.organizations.contact_email IS 'Email de contato da organização para orçamentos e documentos';


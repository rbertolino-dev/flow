-- Adicionar coluna para folha de rosto nos templates de contrato
ALTER TABLE public.contract_templates
ADD COLUMN IF NOT EXISTS cover_page_url TEXT;

-- Comentário
COMMENT ON COLUMN public.contract_templates.cover_page_url IS 'URL da imagem de folha de rosto (fundo) que será usada no PDF. Deve ter exatamente 210x297mm (A4) para encaixar 100%.';



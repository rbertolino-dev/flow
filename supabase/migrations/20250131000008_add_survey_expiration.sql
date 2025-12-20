-- Migration: Adicionar campos de expiração e encerramento em surveys
-- Adiciona expires_at e is_closed para controle de acesso público

-- Adicionar coluna expires_at (data de expiração)
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Adicionar coluna is_closed (pesquisa encerrada manualmente)
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;

-- Adicionar coluna public_slug (slug único para link público)
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS public_slug text;

-- Criar índice único para public_slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_surveys_public_slug ON public.surveys(public_slug) WHERE public_slug IS NOT NULL;

-- Função para gerar slug único
CREATE OR REPLACE FUNCTION generate_survey_slug()
RETURNS text AS $$
DECLARE
  slug text;
  exists_check boolean;
BEGIN
  LOOP
    -- Gerar slug aleatório (8 caracteres alfanuméricos)
    slug := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Verificar se já existe
    SELECT EXISTS(SELECT 1 FROM public.surveys WHERE public_slug = slug) INTO exists_check;
    
    -- Se não existe, retornar
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar slug automaticamente ao criar pesquisa
CREATE OR REPLACE FUNCTION set_survey_public_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_slug IS NULL OR NEW.public_slug = '' THEN
    NEW.public_slug := generate_survey_slug();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_survey_public_slug ON public.surveys;
CREATE TRIGGER trigger_set_survey_public_slug
  BEFORE INSERT ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION set_survey_public_slug();

-- Comentários
COMMENT ON COLUMN public.surveys.expires_at IS 'Data de expiração da pesquisa (opcional). Após esta data, a pesquisa não aceita mais respostas.';
COMMENT ON COLUMN public.surveys.is_closed IS 'Indica se a pesquisa foi encerrada manualmente pelo usuário';
COMMENT ON COLUMN public.surveys.public_slug IS 'Slug único para acesso público à pesquisa via URL /survey/:slug';






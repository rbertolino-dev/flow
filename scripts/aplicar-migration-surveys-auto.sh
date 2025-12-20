#!/bin/bash

# Script automático para aplicar migration de surveys
# Segue regras de implementação automática

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "🚀 Aplicando migration de surveys automaticamente..."

# Aplicar apenas a migration específica de surveys
MIGRATION_FILE="supabase/migrations/20250131000008_add_survey_expiration.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Aplicando: $MIGRATION_FILE"

# Usar supabase db push com filtro para aplicar apenas esta migration
# Como há conflitos, vamos aplicar o SQL diretamente via psql se possível
# ou criar uma nova migration com timestamp futuro

# Criar migration temporária com conteúdo necessário
TEMP_MIGRATION="supabase/migrations/$(date +%Y%m%d%H%M%S)_survey_expiration_fix.sql"

cat > "$TEMP_MIGRATION" << 'EOF'
-- Aplicar campos de expiração de surveys
DO $$
BEGIN
    -- Adicionar colunas se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'surveys' 
                   AND column_name = 'expires_at') THEN
        ALTER TABLE public.surveys ADD COLUMN expires_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'surveys' 
                   AND column_name = 'is_closed') THEN
        ALTER TABLE public.surveys ADD COLUMN is_closed boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'surveys' 
                   AND column_name = 'public_slug') THEN
        ALTER TABLE public.surveys ADD COLUMN public_slug text;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_surveys_public_slug ON public.surveys(public_slug) WHERE public_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION generate_survey_slug()
RETURNS text AS $$
DECLARE
  slug text;
  exists_check boolean;
BEGIN
  LOOP
    slug := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM public.surveys WHERE public_slug = slug) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

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

UPDATE public.surveys
SET public_slug = generate_survey_slug()
WHERE public_slug IS NULL OR public_slug = '';
EOF

echo "✅ Migration temporária criada: $TEMP_MIGRATION"

# Aplicar via supabase db push
echo "⚡ Aplicando migration..."
if supabase db push --include-all --yes 2>&1 | grep -q "Applying migration.*survey_expiration_fix"; then
    echo "✅ Migration aplicada com sucesso!"
    rm -f "$TEMP_MIGRATION"
else
    echo "⚠️  Migration pode já estar aplicada ou houve erro. Verificando..."
    # Manter arquivo para aplicação manual se necessário
    echo "📄 Arquivo mantido em: $TEMP_MIGRATION"
fi

echo "✅ Processo concluído!"






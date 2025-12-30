#!/bin/bash

# ============================================
# Aplicar Migration Broadcast Campaigns Automaticamente
# ============================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Broadcast Campaigns${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Carregar variáveis de ambiente
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

SUPABASE_URL="${SUPABASE_URL:-https://ogeljmbhqxpfjbpnbwog.supabase.co}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY não encontrada${NC}"
    echo -e "${YELLOW}💡 Configure no arquivo .env${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Aplicando migration via função SQL RPC...${NC}"

# Primeiro, criar a função SQL se não existir
echo -e "${BLUE}1/2 - Criando função SQL...${NC}"

FUNCTION_SQL=$(cat <<'EOF'
CREATE OR REPLACE FUNCTION public.apply_broadcast_migration()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_text TEXT := '';
BEGIN
  -- Permitir instance_id NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ALTER COLUMN instance_id DROP NOT NULL;
    result_text := result_text || '✅ instance_id agora permite NULL. ';
  ELSE
    result_text := result_text || 'ℹ️  instance_id já permite NULL. ';
  END IF;

  -- Adicionar coluna sending_method se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'sending_method'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN sending_method TEXT DEFAULT 'single';
    result_text := result_text || '✅ Coluna sending_method adicionada. ';
  ELSE
    result_text := result_text || 'ℹ️  Coluna sending_method já existe. ';
  END IF;

  RETURN result_text || 'Migration concluída!';
EXCEPTION
  WHEN OTHERS THEN
    RETURN '❌ Erro: ' || SQLERRM;
END;
$$;
EOF
)

# Aplicar migration completa
MIGRATION_SQL=$(cat <<'EOF'
-- Permitir instance_id NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ALTER COLUMN instance_id DROP NOT NULL;
  END IF;
END $$;

-- Adicionar coluna sending_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'sending_method'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN sending_method TEXT DEFAULT 'single';
  END IF;
END $$;
EOF
)

# Tentar aplicar via Supabase Management API
echo -e "${BLUE}2/2 - Aplicando migration...${NC}"

RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/ogeljmbhqxpfjbpnbwog/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"${MIGRATION_SQL//\"/\\\"}\"}")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration aplicada via API!${NC}"
    echo -e "${GREEN}Resultado: ${RESPONSE}${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível aplicar via API${NC}"
    echo -e "${YELLOW}💡 Aplique manualmente via Supabase Dashboard:${NC}"
    echo -e "${BLUE}   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new${NC}"
    echo ""
    echo -e "${BLUE}📄 SQL para copiar:${NC}"
    echo "$MIGRATION_SQL"
fi

echo ""
echo -e "${GREEN}✅ Script concluído!${NC}"


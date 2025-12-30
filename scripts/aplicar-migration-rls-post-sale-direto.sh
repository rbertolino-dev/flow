#!/bin/bash

# Script para aplicar migration RLS Post-Sale diretamente via SQL
# Cria diretório temporário isolado apenas com esta migration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20251230100000_fix_lead_follow_ups_rls_for_post_sale.sql"
PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration RLS Post-Sale (Direto) ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    exit 1
fi

# Criar diretório temporário isolado
TEMP_DIR=$(mktemp -d)
echo -e "${BLUE}📦 Criando ambiente temporário isolado...${NC}"
cd "$TEMP_DIR"
mkdir -p supabase/migrations

# Copiar apenas esta migration
cp "$MIGRATION_FILE" supabase/migrations/

# Linkar projeto
echo -e "${BLUE}🔗 Linkando projeto Supabase...${NC}"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

# Aplicar migration
echo ""
echo -e "${BLUE}⚡ Aplicando migration diretamente...${NC}"
echo ""

if echo "y" | timeout 180 supabase db push --include-all 2>&1 | tee /tmp/migration_rls_post_sale_direto.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Erro ao aplicar migration${NC}"
    tail -30 /tmp/migration_rls_post_sale_direto.log
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
    exit 1
fi


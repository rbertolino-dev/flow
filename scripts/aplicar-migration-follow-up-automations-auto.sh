#!/bin/bash

# Script para aplicar migration de follow_up_step_automations automaticamente
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20251222202000_create_follow_up_step_automations_if_not_exists.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Follow-Up Automations║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

# Verificar se Supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    exit 1
fi

# Linkar projeto se necessário
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo -e "${BLUE}🔗 Linkando projeto Supabase...${NC}"
    supabase link --project-ref ogeljmbhqxpfjbpnbwog 2>&1 | grep -v "new version" || true
fi

# Aplicar migration
echo -e "${BLUE}⚡ Aplicando migration...${NC}"
if echo "y" | timeout 300 supabase db push --include-all 2>&1 | tee /tmp/migration_follow_up_automations.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    exit 0
else
    # Verificar se migration já foi aplicada
    if grep -q "already exists\|duplicate" /tmp/migration_follow_up_automations.log 2>/dev/null; then
        echo ""
        echo -e "${GREEN}✅ Migration já estava aplicada${NC}"
        exit 0
    else
        echo ""
        echo -e "${YELLOW}⚠️  Erro ao aplicar migration${NC}"
        echo -e "${BLUE}📄 Verifique: $MIGRATION_FILE${NC}"
        exit 1
    fi
fi


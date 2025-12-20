#!/bin/bash

# 🚀 Script: Aplicar Migration de Orçamentos via SQL Editor
# Descrição: Abre o SQL Editor do Supabase com a migration pronta para executar
# Uso: ./scripts/aplicar-migration-budgets-sql-editor.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
SQL_EDITOR_URL="https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration de Orçamentos       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Combinar migrations
TEMP_SQL=$(mktemp)
cat supabase/migrations/20251218205000_create_budgets_module_complete.sql > "$TEMP_SQL"
cat supabase/migrations/20251218205100_create_budget_storage_bucket.sql >> "$TEMP_SQL"

echo -e "${GREEN}✅ SQL preparado em: $TEMP_SQL${NC}"
echo ""
echo -e "${YELLOW}📋 PRÓXIMOS PASSOS:${NC}"
echo ""
echo -e "${BLUE}1. Acesse o SQL Editor:${NC}"
echo "   $SQL_EDITOR_URL"
echo ""
echo -e "${BLUE}2. Cole o SQL abaixo e execute (Run):${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
cat "$TEMP_SQL"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Após executar, o módulo de orçamentos estará 100% funcional!${NC}"
echo ""
echo -e "${BLUE}💡 Dica: O SQL também está salvo em: $TEMP_SQL${NC}"


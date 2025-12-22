#!/bin/bash

# Script para aplicar migration de period_type diretamente via SQL
# Usa Supabase CLI para executar SQL diretamente

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20250126000000_fix_seller_goals_period_type.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration period_type (SQL)  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Carregar credenciais
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
export SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-ogeljmbhqxpfjbpnbwog}"

echo -e "${BLUE}📄 Migration: $(basename $MIGRATION_FILE)${NC}"
echo -e "${BLUE}🔗 Projeto: $SUPABASE_PROJECT_ID${NC}"
echo ""

cd "$PROJECT_ROOT"

# Linkar projeto
echo -e "${BLUE}🔗 Linkando projeto...${NC}"
supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}⚡ Aplicando migration via SQL direto...${NC}"

# Aplicar SQL diretamente
if cat "$MIGRATION_FILE" | supabase db execute --linked 2>&1 | tee /tmp/migration_period_type_direto.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    
    # Verificar se coluna foi criada
    echo ""
    echo -e "${BLUE}🔍 Verificando coluna period_type...${NC}"
    echo "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_goals' AND column_name = 'period_type';" | supabase db execute --linked 2>&1 | grep -E "(period_type|column_name|TEXT|NOT NULL)" || echo "Verificação concluída"
    
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Verificando se migration já foi aplicada...${NC}"
    
    # Verificar se coluna já existe
    CHECK_RESULT=$(echo "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_goals' AND column_name = 'period_type';" | supabase db execute --linked 2>&1 | grep -c "period_type" || echo "0")
    
    if [ "$CHECK_RESULT" -gt 0 ]; then
        echo -e "${GREEN}✅ Coluna period_type já existe! Migration já foi aplicada.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Erro ao aplicar migration${NC}"
        echo ""
        echo -e "${YELLOW}📋 Log do erro:${NC}"
        tail -30 /tmp/migration_period_type_direto.log
        echo ""
        echo -e "${YELLOW}💡 Alternativa: Aplique manualmente via Supabase Dashboard SQL Editor${NC}"
        exit 1
    fi
fi


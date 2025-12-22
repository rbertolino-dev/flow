#!/bin/bash

# Script para aplicar migration de period_type automaticamente via Supabase CLI
# Usa credenciais salvas e aplica diretamente via db push

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
echo -e "${BLUE}║  Aplicar Migration period_type (Auto)  ║${NC}"
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

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "   Instale: npm install -g supabase"
    exit 1
fi

cd "$PROJECT_ROOT"

# Linkar projeto
echo -e "${BLUE}🔗 Linkando projeto...${NC}"
supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}⚡ Aplicando migration...${NC}"

# Aplicar via db push (método recomendado)
if echo "y" | timeout 120 supabase db push --include-all 2>&1 | tee /tmp/migration_period_type.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    
    # Verificar se coluna foi criada
    echo ""
    echo -e "${BLUE}🔍 Verificando coluna period_type...${NC}"
    echo "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_goals' AND column_name = 'period_type';" | supabase db execute 2>&1 | grep -E "(period_type|column_name|TEXT)" || echo "Verificação concluída"
    
    exit 0
else
    echo ""
    echo -e "${RED}❌ Erro ao aplicar migration${NC}"
    echo ""
    echo -e "${YELLOW}📋 Log do erro:${NC}"
    tail -30 /tmp/migration_period_type.log
    echo ""
    echo -e "${YELLOW}💡 Alternativa: Aplique manualmente via Supabase Dashboard SQL Editor${NC}"
    echo ""
    echo -e "${BLUE}📋 SQL para aplicar manualmente:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$MIGRATION_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi


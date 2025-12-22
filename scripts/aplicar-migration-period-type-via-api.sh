#!/bin/bash

# Script para aplicar migration de period_type via Supabase Management API
# Usa API REST do Supabase para executar SQL diretamente

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
echo -e "${BLUE}║  Aplicar Migration period_type (API)   ║${NC}"
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

# Ler conteúdo da migration
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Escapar JSON
SQL_ESCAPED=$(echo "$SQL_CONTENT" | jq -Rs .)

echo -e "${BLUE}⚡ Aplicando migration via API...${NC}"

# Aplicar via Management API
RESPONSE=$(curl -s -X POST \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": ${SQL_ESCAPED}}" 2>&1)

# Verificar resposta
if echo "$RESPONSE" | grep -q "error\|Error\|ERROR"; then
    # Verificar se é erro de "já existe" (isso é OK)
    if echo "$RESPONSE" | grep -qi "already exists\|duplicate"; then
        echo -e "${YELLOW}⚠️  Algumas entidades já existem (isso é normal)${NC}"
        echo ""
        echo -e "${GREEN}✅ Migration aplicada (com avisos de duplicação)${NC}"
    else
        echo -e "${RED}❌ Erro ao aplicar migration${NC}"
        echo ""
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        echo ""
        echo -e "${YELLOW}💡 Alternativa: Aplique manualmente via Supabase Dashboard SQL Editor${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
fi

# Verificar se coluna foi criada
echo ""
echo -e "${BLUE}🔍 Verificando coluna period_type...${NC}"

CHECK_SQL='SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = '\''public'\'' AND table_name = '\''seller_goals'\'' AND column_name = '\''period_type'\'';'
CHECK_ESCAPED=$(echo "$CHECK_SQL" | jq -Rs .)

CHECK_RESPONSE=$(curl -s -X POST \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": ${CHECK_ESCAPED}}" 2>&1)

if echo "$CHECK_RESPONSE" | grep -q "period_type"; then
    echo -e "${GREEN}✅ Coluna period_type criada com sucesso!${NC}"
    echo "$CHECK_RESPONSE" | jq '.' 2>/dev/null || echo "$CHECK_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Não foi possível verificar coluna via API${NC}"
    echo "   Verifique manualmente no Supabase Dashboard"
fi

echo ""
echo -e "${GREEN}✅ Processo concluído!${NC}"


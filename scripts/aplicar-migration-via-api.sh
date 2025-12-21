#!/bin/bash

# 🚀 Script: Aplicar Migration via API Supabase
# Descrição: Aplica migration específica usando API REST do Supabase
# Uso: ./scripts/aplicar-migration-via-api.sh [arquivo.sql]

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

# Carregar credenciais
source .supabase-cli-config

if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Erro: Arquivo SQL não fornecido${NC}"
    echo ""
    echo "Uso: ./scripts/aplicar-migration-via-api.sh [arquivo.sql]"
    exit 1
fi

SQL_FILE="$1"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration via API             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📄 Migration: $(basename "$SQL_FILE")"
echo "🔗 Projeto: $SUPABASE_PROJECT_ID"
echo ""

# Ler conteúdo do arquivo SQL
SQL_CONTENT=$(cat "$SQL_FILE")

# Usar API Management do Supabase
MANAGEMENT_URL="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"

echo -e "${BLUE}⚡ Executando SQL via API Management...${NC}"
echo ""

# Executar SQL via API Management
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}" \
    "$MANAGEMENT_URL" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    echo ""
    if [ -n "$BODY" ] && [ "$BODY" != "[]" ]; then
        echo "Resposta:"
        echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    fi
else
    echo -e "${RED}❌ Erro ao aplicar migration${NC}"
    echo "HTTP Code: $HTTP_CODE"
    echo "Resposta:"
    echo "$BODY"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Operação concluída!${NC}"


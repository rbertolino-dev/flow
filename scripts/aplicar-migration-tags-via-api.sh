#!/bin/bash

# 🚀 Script: Aplicar Migration Tags via API Supabase
# Descrição: Aplica migration de correção da tabela tags usando API REST do Supabase
# Uso: ./scripts/aplicar-migration-tags-via-api.sh

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

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Tags via API       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📄 Migration: 20251221002523_fix_tags_table_remove_user_id.sql"
echo "🔗 Projeto: $SUPABASE_PROJECT_ID"
echo ""

# Ler conteúdo do arquivo SQL
SQL_FILE="supabase/migrations/20251221002523_fix_tags_table_remove_user_id.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

SQL_CONTENT=$(cat "$SQL_FILE")

# URL da API do Supabase para executar SQL
API_URL="https://$SUPABASE_PROJECT_ID.supabase.co/rest/v1/rpc/exec_sql"

echo -e "${BLUE}⚡ Executando SQL via API REST...${NC}"
echo ""

# Executar SQL via API REST usando curl
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_ACCESS_TOKEN" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}" \
    "$API_URL" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    echo ""
    echo "Resposta:"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
    echo -e "${YELLOW}⚠️  Tentando método alternativo via Supabase CLI db execute...${NC}"
    
    # Método alternativo: usar psql via API
    # Primeiro, vamos tentar usar supabase db execute se disponível
    if command -v psql &> /dev/null; then
        echo -e "${BLUE}📄 Executando via psql...${NC}"
        # Não temos conexão direta, então vamos usar outro método
    fi
    
    # Tentar via API Management
    echo -e "${BLUE}📄 Tentando via API Management...${NC}"
    
    # Usar API de Management do Supabase
    MANAGEMENT_URL="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"
    
    RESPONSE2=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}" \
        "$MANAGEMENT_URL" 2>&1)
    
    HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
    BODY2=$(echo "$RESPONSE2" | sed '$d')
    
    if [ "$HTTP_CODE2" = "200" ] || [ "$HTTP_CODE2" = "201" ]; then
        echo -e "${GREEN}✅ Migration aplicada com sucesso via API Management!${NC}"
        echo ""
        echo "Resposta:"
        echo "$BODY2" | jq . 2>/dev/null || echo "$BODY2"
    else
        echo -e "${RED}❌ Erro ao aplicar migration${NC}"
        echo "HTTP Code: $HTTP_CODE2"
        echo "Resposta:"
        echo "$BODY2"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ Operação concluída!${NC}"



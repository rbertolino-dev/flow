#!/bin/bash

# Script para adicionar a feature "digital_contracts" ao enum organization_feature
# Usa a Management API do Supabase

set -e

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔧 Adicionando feature 'digital_contracts' ao enum organization_feature...${NC}"

# Verificar se as variáveis de ambiente estão definidas
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Erro: Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidas${NC}"
    echo "Execute: export SUPABASE_URL=... && export SUPABASE_SERVICE_ROLE_KEY=..."
    exit 1
fi

# Ler o SQL do arquivo
SQL_FILE="APLICAR-DIGITAL-CONTRACTS-FEATURE.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo $SQL_FILE não encontrado${NC}"
    exit 1
fi

SQL_CONTENT=$(cat "$SQL_FILE")

# Extrair PROJECT_ID da URL
PROJECT_ID=$(echo "$SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co|\1|p')

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Erro: Não foi possível extrair PROJECT_ID da URL${NC}"
    exit 1
fi

echo -e "${YELLOW}📡 Aplicando SQL via Management API...${NC}"

# Aplicar SQL via Management API
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$SQL_CONTENT\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✅ Feature 'digital_contracts' adicionada com sucesso!${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ Erro ao aplicar SQL (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    exit 1
fi

echo -e "${GREEN}✅ Concluído!${NC}"


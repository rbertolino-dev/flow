#!/bin/bash

# Script para adicionar digital_contracts ao enum via Management API
# Segue as regras de automação do projeto

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Adicionar digital_contracts ao Enum  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Carregar variáveis
if [ -f .env ]; then
    source .env
fi

# Verificar variáveis
if [ -z "$VITE_SUPABASE_URL" ]; then
    echo -e "${RED}❌ VITE_SUPABASE_URL não encontrada${NC}"
    exit 1
fi

PROJECT_ID=$(echo "$VITE_SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co|\1|p')

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Não foi possível extrair PROJECT_ID${NC}"
    exit 1
fi

echo -e "${BLUE}📋 PROJECT_ID: $PROJECT_ID${NC}"

# Ler SQL
SQL_FILE="APLICAR-DIGITAL-CONTRACTS-FINAL.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo $SQL_FILE não encontrado${NC}"
    exit 1
fi

SQL_CONTENT=$(cat "$SQL_FILE")

# Escapar JSON
SQL_CONTENT_ESCAPED=$(echo "$SQL_CONTENT" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

echo -e "${YELLOW}📡 Aplicando SQL via Management API...${NC}"

# Tentar via Management API
if [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${BLUE}🔑 Usando SERVICE_ROLE_KEY do .env${NC}"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        "https://${PROJECT_ID}.supabase.co/rest/v1/rpc/exec_sql" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$SQL_CONTENT_ESCAPED\"}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
        echo -e "${GREEN}✅ SQL aplicado com sucesso!${NC}"
        echo "$BODY"
        exit 0
    else
        echo -e "${YELLOW}⚠️  HTTP $HTTP_CODE - Tentando método alternativo...${NC}"
        echo "$BODY"
    fi
fi

# Método alternativo: usar Supabase CLI
echo -e "${YELLOW}🔄 Tentando via Supabase CLI...${NC}"

if command -v supabase &> /dev/null; then
    # Criar arquivo temporário
    TEMP_SQL=$(mktemp)
    echo "$SQL_CONTENT" > "$TEMP_SQL"
    
    # Tentar aplicar
    if supabase db push --include-all < "$TEMP_SQL" 2>&1; then
        echo -e "${GREEN}✅ Aplicado via CLI!${NC}"
        rm -f "$TEMP_SQL"
        exit 0
    else
        echo -e "${YELLOW}⚠️  CLI falhou${NC}"
        rm -f "$TEMP_SQL"
    fi
fi

# Se tudo falhar, mostrar instruções
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  Aplicação automática falhou${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Aplique manualmente:${NC}"
echo ""
echo "1. Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
echo ""
echo "2. Cole o conteúdo de: $SQL_FILE"
echo ""
echo "3. Execute (Run)"
echo ""
echo -e "${GREEN}✅ Após aplicar, o erro será resolvido!${NC}"
echo ""

exit 1


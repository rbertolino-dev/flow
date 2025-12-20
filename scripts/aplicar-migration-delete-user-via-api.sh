#!/bin/bash
# 🚀 Script: Aplicar Migration delete_user_from_organization via API
# Tenta aplicar via Management API do Supabase

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
MIGRATION_FILE="supabase/migrations/20251218002011_fix_delete_user_from_organization.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration via API            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq não encontrado, instalando...${NC}"
    apt-get update -qq && apt-get install -y -qq jq > /dev/null 2>&1 || {
        echo -e "${RED}❌ Não foi possível instalar jq${NC}"
        echo "   Instale manualmente: apt-get install -y jq"
        exit 1
    }
fi

echo -e "${BLUE}📄 Migration: $(basename $MIGRATION_FILE)${NC}"
echo ""

# Ler SQL
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Escapar SQL para JSON
SQL_ESCAPED=$(echo "$SQL_CONTENT" | jq -Rs .)

echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "   Para aplicar esta migration, você precisa:"
echo ""
echo -e "${BLUE}📋 OPÇÃO 1: Via SQL Editor (RECOMENDADO)${NC}"
echo "   1. Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
echo "   2. Cole o SQL abaixo:"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
cat "$MIGRATION_FILE"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "   3. Clique em 'Run' para executar"
echo ""

# Tentar via Management API (se tiver Service Role Key)
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${BLUE}🔑 Tentando aplicar via Management API...${NC}"
    
    RESPONSE=$(curl -s -X POST \
        "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": ${SQL_ESCAPED}}" 2>&1)
    
    if echo "$RESPONSE" | jq -e . > /dev/null 2>&1; then
        if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
            echo -e "${RED}❌ Erro na API:${NC}"
            echo "$RESPONSE" | jq .
        else
            echo -e "${GREEN}✅ Migration aplicada via API!${NC}"
            echo "$RESPONSE" | jq .
            exit 0
        fi
    else
        echo -e "${YELLOW}⚠️  Resposta da API não é JSON válido${NC}"
        echo "$RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠️  SUPABASE_SERVICE_ROLE_KEY não configurada${NC}"
    echo "   Use a OPÇÃO 1 acima (SQL Editor)"
fi

echo ""
echo -e "${BLUE}✅ Instruções completas salvas em: APLICAR-MIGRATION-DELETE-USER.md${NC}"






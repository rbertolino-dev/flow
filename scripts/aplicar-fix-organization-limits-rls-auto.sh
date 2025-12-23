#!/bin/bash

# Script para aplicar fix de RLS da tabela organization_limits via Management API
# Aplica automaticamente via Supabase Management API

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20250131000000_fix_organization_limits_rls.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Fix RLS organization_limits   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Carregar credenciais do Supabase CLI
if [ -f "$PROJECT_ROOT/.supabase-cli-config" ]; then
    source "$PROJECT_ROOT/.supabase-cli-config"
fi

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_3c4c0840440fb94a32052c9523dd46949af8af19}"
export SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-ogeljmbhqxpfjbpnbwog}"

echo -e "${BLUE}📄 Migration: $(basename $MIGRATION_FILE)${NC}"
echo -e "${BLUE}🔗 Projeto: $SUPABASE_PROJECT_ID${NC}"
echo ""

# Ler conteúdo da migration
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq não encontrado. Instalando...${NC}"
    apt-get update -qq && apt-get install -y -qq jq > /dev/null 2>&1 || {
        echo -e "${RED}❌ Não foi possível instalar jq${NC}"
        echo -e "${YELLOW}📋 Aplique manualmente via Dashboard:${NC}"
        echo "   https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql/new"
        exit 1
    }
fi

# Escapar JSON
SQL_ESCAPED=$(echo "$SQL_CONTENT" | jq -Rs .)

echo -e "${BLUE}⚡ Aplicando migration via Management API...${NC}"

# Aplicar via Management API
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": ${SQL_ESCAPED}}" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Verificar resposta
if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    exit 0
elif echo "$BODY" | grep -qi "already exists\|duplicate\|already applied"; then
    echo -e "${YELLOW}⚠️  Migration já foi aplicada anteriormente${NC}"
    echo -e "${GREEN}✅ Tudo certo!${NC}"
    exit 0
else
    echo -e "${RED}❌ Erro ao aplicar migration (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}📋 Alternativa: Aplique manualmente via Dashboard:${NC}"
    echo "   https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql/new"
    exit 1
fi


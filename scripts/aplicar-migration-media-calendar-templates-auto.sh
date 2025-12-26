#!/bin/bash
# Script para aplicar migration de media_url e media_type para calendar_message_templates
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

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20250201000000_add_media_to_calendar_templates.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Media Templates     ║${NC}"
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

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq não encontrado. Tentando método alternativo...${NC}"
    
    # Método alternativo: usar Supabase CLI
    if command -v supabase &> /dev/null; then
        echo -e "${BLUE}⚡ Aplicando via Supabase CLI...${NC}"
        supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
        
        # Criar arquivo temporário e aplicar
        TEMP_SQL=$(mktemp)
        echo "$SQL_CONTENT" > "$TEMP_SQL"
        
        # Tentar aplicar via db push
        if echo "y" | timeout 180 supabase db push --include-all 2>&1 | tee /tmp/migration_media.log; then
            echo ""
            echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
            rm -f "$TEMP_SQL"
            exit 0
        else
            echo -e "${YELLOW}⚠️  Erro ao aplicar via CLI. Tente manualmente via SQL Editor.${NC}"
            rm -f "$TEMP_SQL"
            exit 1
        fi
    else
        echo -e "${RED}❌ jq e supabase CLI não encontrados${NC}"
        echo -e "${YELLOW}📋 Aplique manualmente via Dashboard:${NC}"
        echo "   https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql/new"
        echo ""
        echo "SQL:"
        echo "$SQL_CONTENT"
        exit 1
    fi
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
    echo -e "${YELLOW}⚠️  Erro ao aplicar via API (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}📋 Alternativa: Aplique manualmente via Dashboard:${NC}"
    echo "   https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql/new"
    echo ""
    echo "SQL:"
    echo "$SQL_CONTENT"
    exit 1
fi


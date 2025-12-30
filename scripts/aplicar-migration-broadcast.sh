#!/bin/bash

# ============================================
# Script para aplicar migration de broadcast_campaigns
# ============================================

set -e

echo "🔧 Aplicando migration de broadcast_campaigns..."

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se arquivo existe
MIGRATION_FILE="apply-broadcast-migration-completa.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo $MIGRATION_FILE não encontrado${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 SQL que será aplicado:${NC}"
echo "---"
head -20 "$MIGRATION_FILE"
echo "..."
echo "---"
echo ""

# Tentar aplicar via Supabase Dashboard (instruções)
echo -e "${YELLOW}⚠️  A migration precisa ser aplicada manualmente via Supabase Dashboard${NC}"
echo ""
echo -e "${GREEN}🔗 Link direto:${NC}"
echo "https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo ""
echo -e "${GREEN}📋 Passos:${NC}"
echo "1. Acesse o link acima"
echo "2. Cole o SQL abaixo no editor"
echo "3. Clique em 'Run' para executar"
echo ""
echo -e "${GREEN}📄 SQL completo:${NC}"
echo "---"
cat "$MIGRATION_FILE"
echo "---"
echo ""

# Tentar aplicar via API Management (se disponível)
if [ -f ".env" ]; then
    source .env 2>/dev/null || true
    
    if [ ! -z "$SUPABASE_ACCESS_TOKEN" ]; then
        echo -e "${YELLOW}🔄 Tentando aplicar via Supabase Management API...${NC}"
        
        # Escapar SQL para JSON
        SQL_CONTENT=$(cat "$MIGRATION_FILE" | tr '\n' ' ' | sed "s/'/''/g" | sed 's/"/\\"/g')
        
        RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/ogeljmbhqxpfjbpnbwog/database/query" \
            -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"$SQL_CONTENT\"}" 2>&1)
        
        if echo "$RESPONSE" | grep -q "error\|Error\|ERROR"; then
            echo -e "${RED}❌ Erro ao aplicar via API:${NC}"
            echo "$RESPONSE" | head -10
            echo ""
            echo -e "${YELLOW}⚠️  Aplique manualmente via Dashboard${NC}"
        else
            echo -e "${GREEN}✅ Migration enviada via API (verifique se foi aplicada)${NC}"
            echo ""
            echo -e "${YELLOW}🔍 Para verificar, execute no Dashboard:${NC}"
            echo "SELECT column_name, is_nullable, data_type"
            echo "FROM information_schema.columns"
            echo "WHERE table_schema = 'public'"
            echo "  AND table_name = 'broadcast_campaigns'"
            echo "  AND column_name IN ('instance_id', 'sending_method', 'instance_ids');"
        fi
    else
        echo -e "${YELLOW}⚠️  SUPABASE_ACCESS_TOKEN não encontrado no .env${NC}"
        echo -e "${YELLOW}⚠️  Aplique manualmente via Dashboard${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
    echo -e "${YELLOW}⚠️  Aplique manualmente via Dashboard${NC}"
fi

echo ""
echo -e "${GREEN}✅ Instruções exibidas acima${NC}"


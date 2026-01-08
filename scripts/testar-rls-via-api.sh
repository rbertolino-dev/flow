#!/bin/bash

# Script para testar RLS via API do Supabase
# Uso: ./scripts/testar-rls-via-api.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Testar RLS via API do Supabase      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Carregar variáveis de ambiente
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-https://ogeljmbhqxpfjbpnbwog.supabase.co}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ VITE_SUPABASE_PUBLISHABLE_KEY não encontrada${NC}"
    echo "   Configure no arquivo .env"
    exit 1
fi

echo -e "${BLUE}🔍 Testando acesso às tabelas...${NC}"
echo ""

# Testar facebook_configs
echo -e "${YELLOW}1. Testando facebook_configs...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    "${SUPABASE_URL}/rest/v1/facebook_configs?select=*&limit=1" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}   ✅ facebook_configs: OK (200)${NC}"
elif [ "$HTTP_CODE" = "406" ]; then
    echo -e "${RED}   ❌ facebook_configs: Erro 406 (Not Acceptable)${NC}"
    echo -e "${YELLOW}   💡 Aplique a migration: supabase/migrations/20260106000002_fix_facebook_configs_rls.sql${NC}"
else
    echo -e "${RED}   ❌ facebook_configs: Erro ${HTTP_CODE}${NC}"
    echo "   Resposta: $BODY"
fi

echo ""

# Testar evolution_logs
echo -e "${YELLOW}2. Testando evolution_logs...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    "${SUPABASE_URL}/rest/v1/evolution_logs?select=*&limit=1" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}   ✅ evolution_logs: OK (200)${NC}"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}   ❌ evolution_logs: Erro 404 (Not Found)${NC}"
    echo -e "${YELLOW}   💡 Aplique a migration: supabase/migrations/20260106000001_fix_evolution_logs_rls.sql${NC}"
else
    echo -e "${RED}   ❌ evolution_logs: Erro ${HTTP_CODE}${NC}"
    echo "   Resposta: $BODY"
fi

echo ""

# Testar webhook (simulação)
echo -e "${YELLOW}3. Testando evolution-webhook (simulação)...${NC}"
echo -e "${BLUE}   (Este teste requer webhook_secret válido)${NC}"
echo -e "${YELLOW}   💡 Use o teste no frontend para verificar o erro 500${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Testes concluídos!${NC}"
echo ""
echo -e "${YELLOW}💡 Se houver erros, aplique as migrations:${NC}"
echo "   1. supabase/migrations/20260106000001_fix_evolution_logs_rls.sql"
echo "   2. supabase/migrations/20260106000002_fix_facebook_configs_rls.sql"
echo "   3. supabase/migrations/20260106000003_fix_leads_unread_columns.sql"



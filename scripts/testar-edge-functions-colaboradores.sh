#!/bin/bash

# 🧪 Script: Testar Edge Functions de Colaboradores
# Descrição: Testa as Edge Functions automaticamente
# Uso: ./scripts/testar-edge-functions-colaboradores.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar credenciais
source "$SCRIPT_DIR/carregar-credenciais.sh"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Credenciais Supabase não configuradas${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Testar Edge Functions - Colaboradores ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Obter token de autenticação (precisa estar logado)
echo -e "${BLUE}🔐 Obtendo token de autenticação...${NC}"
echo -e "${YELLOW}⚠️  Nota: Este script precisa de um token válido${NC}"
echo ""

# Testar cada função
FUNCTIONS=("employees" "positions" "teams" "employee-history")

for func_name in "${FUNCTIONS[@]}"; do
    echo -e "${BLUE}🧪 Testando $func_name...${NC}"
    
    # Fazer requisição OPTIONS (CORS preflight)
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X OPTIONS \
        "${SUPABASE_URL}/functions/v1/${func_name}" \
        -H "Origin: https://agilizeflow.com.br" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: authorization,content-type")
    
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "204" ]; then
        echo -e "${GREEN}   ✅ CORS preflight OK (${RESPONSE})${NC}"
    else
        echo -e "${YELLOW}   ⚠️  CORS preflight retornou ${RESPONSE}${NC}"
    fi
    
    echo ""
done

echo -e "${GREEN}✅ Testes concluídos!${NC}"
echo ""
echo -e "${BLUE}💡 Para testar com autenticação, use:${NC}"
echo "   curl -X GET '${SUPABASE_URL}/functions/v1/employees' \\"
echo "     -H 'Authorization: Bearer <SEU_TOKEN>' \\"
echo "     -H 'Content-Type: application/json'"


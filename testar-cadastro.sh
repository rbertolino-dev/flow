#!/bin/bash

# 🔍 Script: Testar Cadastro/Signup
# Testa se o signup está funcionando no Supabase

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Teste de Cadastro/Signup             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"
PROJECT_URL="https://ogeljmbhqxpfjbpnbwog.supabase.co"

# Obter Anon Key
echo -e "${YELLOW}🔍 Obtendo Anon Key...${NC}"
ANON_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep -i "anon" | head -1 | awk '{print $NF}' || echo "")

if [ -z "$ANON_KEY" ]; then
    echo -e "${RED}❌ Não foi possível obter Anon Key${NC}"
    echo "   Obtenha manualmente do Dashboard"
    exit 1
fi

echo -e "${GREEN}✅ Anon Key obtida${NC}"
echo ""

# Testar conexão com Supabase
echo -e "${YELLOW}🔍 Testando conexão com Supabase...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROJECT_URL/rest/v1/" -H "apikey: $ANON_KEY" || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Supabase está acessível (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Problema de conexão (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# Testar signup
echo -e "${YELLOW}🔍 Testando signup...${NC}"
TEST_EMAIL="teste-$(date +%s)@exemplo.com"
TEST_PASSWORD="123456"

RESPONSE=$(curl -s -X POST "$PROJECT_URL/auth/v1/signup" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" 2>&1)

echo "Response: $RESPONSE" | head -c 200
echo ""

# Verificar se funcionou
if echo "$RESPONSE" | grep -q "user"; then
    echo -e "${GREEN}✅ Signup funcionou!${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos passos:${NC}"
    echo "   1. Verificar configurações de email confirmation"
    echo "   2. Verificar variáveis .env no servidor"
    echo "   3. Verificar console do navegador"
elif echo "$RESPONSE" | grep -qi "already registered"; then
    echo -e "${YELLOW}⚠️  Email já registrado (normal se já testou)${NC}"
elif echo "$RESPONSE" | grep -qi "email"; then
    echo -e "${YELLOW}⚠️  Possível problema com email confirmation${NC}"
    echo "   Verifique no Dashboard: Authentication → Settings"
else
    echo -e "${RED}❌ Signup falhou${NC}"
    echo "   Verifique a resposta acima"
fi

echo ""
echo -e "${BLUE}📋 Verificações adicionais:${NC}"
echo "   1. Dashboard → Authentication → Providers → Email → Enable signup: ON"
echo "   2. Dashboard → Authentication → Settings → Confirm email: OFF (para testar)"
echo "   3. Verificar .env no servidor Hetzner"
echo "   4. Verificar console do navegador (F12)"




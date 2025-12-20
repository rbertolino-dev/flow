#!/bin/bash

# 🔍 Script Completo: Verificar Página de Cadastro
# Diagnóstico completo do problema de cadastro

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Diagnóstico Completo - Página Cadastro║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"
PROJECT_URL="https://ogeljmbhqxpfjbpnbwog.supabase.co"

# ============================================
# 1. Verificar Anon Key
# ============================================
echo -e "${YELLOW}1️⃣  Verificando Anon Key...${NC}"
ANON_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep -E "anon|public" | head -1 | awk '{print $NF}' || echo "")

if [ -z "$ANON_KEY" ]; then
    echo -e "${RED}❌ Não foi possível obter Anon Key via CLI${NC}"
    echo "   Obtenha manualmente: Dashboard → Settings → API → anon/public key"
    ANON_KEY="[OBTER_MANUALMENTE]"
else
    echo -e "${GREEN}✅ Anon Key obtida: ${ANON_KEY:0:40}...${NC}"
fi
echo ""

# ============================================
# 2. Testar Conexão com Supabase
# ============================================
echo -e "${YELLOW}2️⃣  Testando conexão com Supabase...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROJECT_URL/rest/v1/" -H "apikey: $ANON_KEY" 2>&1 || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Supabase está acessível (HTTP $HTTP_CODE)${NC}"
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}❌ Não foi possível conectar ao Supabase${NC}"
    echo "   Verifique conexão de internet"
else
    echo -e "${YELLOW}⚠️  Resposta inesperada (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# ============================================
# 3. Verificar Edge Functions
# ============================================
echo -e "${YELLOW}3️⃣  Verificando Edge Functions...${NC}"
if supabase functions list 2>/dev/null | grep -q "log-auth-attempt"; then
    echo -e "${GREEN}✅ Edge Function log-auth-attempt está deployada${NC}"
else
    echo -e "${YELLOW}⚠️  Edge Function log-auth-attempt não encontrada${NC}"
    echo "   Execute: supabase functions deploy log-auth-attempt"
fi
echo ""

# ============================================
# 4. Testar Signup
# ============================================
if [ "$ANON_KEY" != "[OBTER_MANUALMENTE]" ]; then
    echo -e "${YELLOW}4️⃣  Testando signup...${NC}"
    TEST_EMAIL="teste-$(date +%s)@exemplo.com"
    TEST_PASSWORD="123456"
    
    RESPONSE=$(curl -s -X POST "$PROJECT_URL/auth/v1/signup" \
      -H "apikey: $ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" 2>&1)
    
    if echo "$RESPONSE" | grep -q "user"; then
        echo -e "${GREEN}✅ Signup funcionou!${NC}"
        echo "   Email de teste: $TEST_EMAIL"
    elif echo "$RESPONSE" | grep -qi "already registered"; then
        echo -e "${YELLOW}⚠️  Email já registrado (normal se já testou)${NC}"
    elif echo "$RESPONSE" | grep -qi "email.*confirm"; then
        echo -e "${YELLOW}⚠️  Email confirmation pode estar habilitado${NC}"
        echo "   Verifique: Dashboard → Authentication → Settings"
    else
        echo -e "${RED}❌ Signup falhou${NC}"
        echo "   Resposta: ${RESPONSE:0:200}"
    fi
else
    echo -e "${YELLOW}4️⃣  Pulando teste de signup (Anon Key não disponível)${NC}"
fi
echo ""

# ============================================
# 5. Resumo e Próximos Passos
# ============================================
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  RESUMO E PRÓXIMOS PASSOS             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Verificações no Dashboard:${NC}"
echo "   1. Authentication → Providers → Email"
echo "      ✅ 'Enable email signup' deve estar ON"
echo ""
echo "   2. Authentication → Settings"
echo "      ⚠️  'Confirm email' - desabilitar para testar"
echo ""
echo "   3. Verificar logs:"
echo "      Dashboard → Logs → Auth Logs"
echo ""
echo -e "${BLUE}🌐 Verificações no Navegador:${NC}"
echo "   1. Abrir: http://agilizeflow.com.br/CADASTRO"
echo "   2. Pressionar F12 (DevTools)"
echo "   3. Aba Console"
echo "   4. Tentar criar conta"
echo "   5. Ver erros no console"
echo ""
echo -e "${BLUE}🖥️  Verificações no Servidor Hetzner:${NC}"
echo "   1. Verificar .env:"
echo "      cat .env | grep VITE_SUPABASE"
echo ""
echo "   2. Verificar se aplicação está rodando"
echo ""
echo -e "${BLUE}📄 Arquivos de ajuda:${NC}"
echo "   - DIAGNOSTICO-CADASTRO.md"
echo "   - CORRIGIR-CADASTRO.md"
echo ""




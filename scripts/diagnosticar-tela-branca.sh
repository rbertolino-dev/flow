#!/bin/bash

# Script de diagnóstico para tela em branco após login
# Verifica possíveis causas do problema

echo "🔍 DIAGNÓSTICO: Tela em Branco Após Login"
echo "=========================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar status dos containers
echo "1️⃣ Verificando status dos containers..."
if docker compose ps | grep -q "Up.*healthy"; then
    echo -e "${GREEN}✅ Containers estão rodando e saudáveis${NC}"
else
    echo -e "${RED}❌ Containers não estão rodando ou não estão saudáveis${NC}"
    docker compose ps
fi
echo ""

# 2. Verificar logs recentes de erro
echo "2️⃣ Verificando logs de erro recentes..."
ERRORS=$(docker compose logs app-blue --tail=500 2>&1 | grep -i -E "(error|exception|failed|uncaught|undefined|null)" | tail -20)
if [ -z "$ERRORS" ]; then
    echo -e "${GREEN}✅ Nenhum erro encontrado nos logs recentes${NC}"
else
    echo -e "${YELLOW}⚠️ Erros encontrados nos logs:${NC}"
    echo "$ERRORS"
fi
echo ""

# 3. Verificar se aplicação está respondendo
echo "3️⃣ Verificando se aplicação está respondendo..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Aplicação está respondendo (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Aplicação não está respondendo corretamente (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# 4. Verificar se há problemas com build
echo "4️⃣ Verificando se build está atualizado..."
BUILD_TIME=$(docker compose exec app-blue stat -c %y /app/dist/index.html 2>/dev/null | head -1 || echo "N/A")
if [ "$BUILD_TIME" != "N/A" ]; then
    echo -e "${GREEN}✅ Build encontrado (última modificação: $BUILD_TIME)${NC}"
else
    echo -e "${YELLOW}⚠️ Não foi possível verificar build${NC}"
fi
echo ""

# 5. Verificar variáveis de ambiente críticas
echo "5️⃣ Verificando variáveis de ambiente..."
ENV_CHECK=$(docker compose exec app-blue env 2>/dev/null | grep -E "(SUPABASE|VITE)" | head -5 || echo "N/A")
if [ "$ENV_CHECK" != "N/A" ]; then
    echo -e "${GREEN}✅ Variáveis de ambiente encontradas${NC}"
    echo "$ENV_CHECK" | sed 's/=.*/=***/'
else
    echo -e "${YELLOW}⚠️ Não foi possível verificar variáveis de ambiente${NC}"
fi
echo ""

# 6. Verificar se há problemas com Supabase
echo "6️⃣ Verificando conectividade com Supabase..."
SUPABASE_URL=$(docker compose exec app-blue env 2>/dev/null | grep "VITE_SUPABASE_URL" | cut -d'=' -f2 || echo "")
if [ -n "$SUPABASE_URL" ]; then
    SUPABASE_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" 2>/dev/null || echo "000")
    if [ "$SUPABASE_CHECK" = "200" ] || [ "$SUPABASE_CHECK" = "401" ] || [ "$SUPABASE_CHECK" = "403" ]; then
        echo -e "${GREEN}✅ Supabase está acessível (HTTP $SUPABASE_CHECK)${NC}"
    else
        echo -e "${RED}❌ Supabase não está acessível (HTTP $SUPABASE_CHECK)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ URL do Supabase não encontrada${NC}"
fi
echo ""

# 7. Verificar arquivos críticos do código
echo "7️⃣ Verificando arquivos críticos do código..."
CRITICAL_FILES=(
    "src/App.tsx"
    "src/main.tsx"
    "src/components/auth/AuthGuard.tsx"
    "src/pages/Index.tsx"
    "src/components/crm/CRMLayout.tsx"
    "src/hooks/useActiveOrganization.ts"
)

MISSING_FILES=()
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file existe${NC}"
    else
        echo -e "${RED}❌ $file NÃO existe${NC}"
        MISSING_FILES+=("$file")
    fi
done
echo ""

# 8. Verificar problemas conhecidos no código
echo "8️⃣ Verificando problemas conhecidos no código..."

# Verificar se AuthGuard está sendo usado corretamente
if grep -q "AuthGuard" src/pages/Index.tsx; then
    echo -e "${GREEN}✅ AuthGuard está sendo usado em Index.tsx${NC}"
else
    echo -e "${RED}❌ AuthGuard NÃO está sendo usado em Index.tsx${NC}"
fi

# Verificar se useActiveOrganization está sendo usado
if grep -q "useActiveOrganization" src/components/crm/CRMLayout.tsx; then
    echo -e "${GREEN}✅ useActiveOrganization está sendo usado em CRMLayout${NC}"
else
    echo -e "${RED}❌ useActiveOrganization NÃO está sendo usado em CRMLayout${NC}"
fi

# Verificar se há problemas com useEffect sem dependências
if grep -q "useEffect.*\[\]" src/components/auth/AuthGuard.tsx; then
    echo -e "${GREEN}✅ AuthGuard tem useEffect com dependências${NC}"
else
    echo -e "${YELLOW}⚠️ Verificar dependências do useEffect no AuthGuard${NC}"
fi
echo ""

# 9. Resumo e recomendações
echo "📋 RESUMO E RECOMENDAÇÕES"
echo "=========================="
echo ""

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Arquivos críticos faltando:${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
fi

echo "🔧 PRÓXIMOS PASSOS:"
echo "1. Verificar console do navegador (F12) para erros JavaScript"
echo "2. Verificar se usuário tem organização no banco de dados"
echo "3. Verificar se localStorage tem 'active_organization_id'"
echo "4. Verificar se AuthGuard está detectando sessão corretamente"
echo "5. Verificar se useActiveOrganization está retornando activeOrgId"
echo ""
echo "💡 COMANDOS ÚTEIS:"
echo "  - Ver logs em tempo real: docker compose logs -f app-blue"
echo "  - Verificar sessão no navegador: localStorage.getItem('sb-*-auth-token')"
echo "  - Verificar organização: localStorage.getItem('active_organization_id')"
echo ""




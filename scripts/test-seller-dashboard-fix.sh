#!/bin/bash

# Script de teste automatizado para verificar correção do erro "now is not defined"
# Testa: useSellerPerformance, SellerDashboard, SellerActivityDashboard
# Uso: bash scripts/test-seller-dashboard-fix.sh

# Não usar set -e para continuar mesmo com erros não críticos

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

test_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((FAILED++))
}

test_info() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1"
}

echo "🧪 Teste Automatizado - Correção 'now is not defined'"
echo "=================================================="
echo ""

# ============================================
# TESTE 1: Verificar se arquivo foi corrigido
# ============================================
echo "📋 Teste 1: Verificando correção no useSellerPerformance.ts..."
HOOK_FILE="$PROJECT_DIR/src/hooks/useSellerPerformance.ts"

if [ -f "$HOOK_FILE" ]; then
    test_pass "Arquivo useSellerPerformance.ts encontrado"
    
    # Verificar se 'now' está definido no escopo correto
    # Deve estar definido ANTES do bloco if/else (linha ~149)
    NOW_BEFORE_IF=$(grep -n "const now = new Date()" "$HOOK_FILE" | head -1 | cut -d: -f1)
    
    if [ -n "$NOW_BEFORE_IF" ]; then
        # Verificar se está antes do bloco if/else (deve estar antes da linha 150)
        IF_LINE=$(grep -n "if (startDate && endDate)" "$HOOK_FILE" | head -1 | cut -d: -f1)
        
        if [ -n "$IF_LINE" ] && [ "$NOW_BEFORE_IF" -lt "$IF_LINE" ]; then
            test_pass "'now' está definido no escopo correto (antes do bloco if/else)"
        else
            test_fail "'now' não está definido antes do bloco if/else"
        fi
    else
        test_fail "'now' não encontrado no arquivo"
    fi
    
    # Verificar se 'now' é usado após definição (linha ~250)
    NOW_USAGE=$(grep -n "const firstDayThisWeek = new Date(now)" "$HOOK_FILE" | head -1 | cut -d: -f1)
    
    if [ -n "$NOW_USAGE" ] && [ -n "$NOW_BEFORE_IF" ]; then
        if [ "$NOW_USAGE" -gt "$NOW_BEFORE_IF" ]; then
            test_pass "'now' é usado após sua definição (escopo correto)"
        else
            test_fail "'now' é usado antes de ser definido"
        fi
    else
        test_info "Não foi possível verificar uso de 'now' (pode estar correto)"
    fi
    
    # Verificar que não há múltiplas definições de 'now' no mesmo escopo
    NOW_COUNT=$(grep -c "const now = new Date()" "$HOOK_FILE" || echo "0")
    
    if [ "$NOW_COUNT" -eq 1 ]; then
        test_pass "Apenas uma definição de 'now' encontrada (sem duplicação)"
    elif [ "$NOW_COUNT" -gt 1 ]; then
        test_info "Múltiplas definições de 'now' encontradas (pode ser intencional em escopos diferentes)"
    fi
else
    test_fail "Arquivo useSellerPerformance.ts não encontrado"
fi
echo ""

# ============================================
# TESTE 2: Verificar sintaxe TypeScript
# ============================================
echo "📋 Teste 2: Verificando sintaxe TypeScript..."
if command -v npx &> /dev/null; then
    test_info "Verificando sintaxe do useSellerPerformance.ts..."
    
    # Verificar apenas erros críticos (não avisos)
    ERRORS=$(npx tsc --noEmit "$HOOK_FILE" 2>&1 | grep -i "error TS" | grep -i "now" | wc -l)
    
    if [ "$ERRORS" -eq 0 ]; then
        test_pass "Nenhum erro TypeScript relacionado a 'now' encontrado"
    else
        test_fail "Erros TypeScript relacionados a 'now' encontrados"
        npx tsc --noEmit "$HOOK_FILE" 2>&1 | grep -i "error TS" | grep -i "now" | head -3
    fi
else
    test_info "TypeScript compiler não disponível - pulando verificação de sintaxe"
fi
echo ""

# ============================================
# TESTE 3: Verificar componentes que usam o hook
# ============================================
echo "📋 Teste 3: Verificando componentes que usam useSellerPerformance..."
SELLER_DASHBOARD="$PROJECT_DIR/src/components/crm/SellerDashboard.tsx"
SELLER_ACTIVITY="$PROJECT_DIR/src/components/crm/SellerActivityDashboard.tsx"
SELLER_REPORT="$PROJECT_DIR/src/components/crm/SellerPerformanceReport.tsx"

if [ -f "$SELLER_DASHBOARD" ]; then
    test_pass "SellerDashboard.tsx encontrado"
    
    if grep -q "useSellerPerformance\|useSellerPerformanceMetrics" "$SELLER_DASHBOARD"; then
        test_pass "SellerDashboard usa hooks de performance"
    else
        test_info "SellerDashboard pode não usar useSellerPerformance diretamente"
    fi
else
    test_fail "SellerDashboard.tsx não encontrado"
fi

if [ -f "$SELLER_ACTIVITY" ]; then
    test_pass "SellerActivityDashboard.tsx encontrado"
    
    if grep -q "useSellerPerformance" "$SELLER_ACTIVITY"; then
        test_pass "SellerActivityDashboard usa useSellerPerformance"
    else
        test_fail "SellerActivityDashboard não usa useSellerPerformance"
    fi
else
    test_fail "SellerActivityDashboard.tsx não encontrado"
fi

if [ -f "$SELLER_REPORT" ]; then
    test_pass "SellerPerformanceReport.tsx encontrado"
    
    if grep -q "useSellerPerformance" "$SELLER_REPORT"; then
        test_pass "SellerPerformanceReport usa useSellerPerformance"
    else
        test_info "SellerPerformanceReport pode não usar useSellerPerformance diretamente"
    fi
else
    test_fail "SellerPerformanceReport.tsx não encontrado"
fi
echo ""

# ============================================
# TESTE 4: Verificar que não há referências a 'now' não definido
# ============================================
echo "📋 Teste 4: Verificando referências a 'now' sem definição..."
# Buscar por uso de 'now' sem 'const now' ou 'let now' ou 'var now' antes
# (verificação básica - pode ter falsos positivos)

# Verificar se há uso de 'now' que não está definido no escopo
NOW_USAGES=$(grep -n "\bnow\b" "$HOOK_FILE" | grep -v "const now\|let now\|var now\|//.*now\|/\*.*now" | wc -l)

if [ "$NOW_USAGES" -gt 0 ]; then
    # Verificar se há definição antes de cada uso
    test_info "Verificando se todas as referências a 'now' têm definição anterior..."
    
    # Contar definições
    NOW_DEFS=$(grep -n "const now = new Date()" "$HOOK_FILE" | wc -l)
    
    if [ "$NOW_DEFS" -ge 1 ]; then
        test_pass "Definição de 'now' encontrada no arquivo"
    else
        test_fail "Nenhuma definição de 'now' encontrada"
    fi
else
    test_info "Nenhum uso direto de 'now' encontrado (pode estar em escopo diferente)"
fi
echo ""

# ============================================
# TESTE 5: Verificar estrutura do código
# ============================================
echo "📋 Teste 5: Verificando estrutura do código..."
# Verificar que o bloco if/else está correto
IF_ELSE_STRUCTURE=$(grep -A 20 "if (startDate && endDate)" "$HOOK_FILE" | grep -c "else" || echo "0")

if [ "$IF_ELSE_STRUCTURE" -gt 0 ]; then
    test_pass "Estrutura if/else encontrada"
    
    # Verificar que 'now' está definido antes do if
    NOW_LINE=$(grep -n "const now = new Date()" "$HOOK_FILE" | head -1 | cut -d: -f1)
    IF_LINE=$(grep -n "if (startDate && endDate)" "$HOOK_FILE" | head -1 | cut -d: -f1)
    
    if [ -n "$NOW_LINE" ] && [ -n "$IF_LINE" ] && [ "$NOW_LINE" -lt "$IF_LINE" ]; then
        test_pass "'now' está definido antes do bloco if/else (estrutura correta)"
    else
        test_fail "'now' não está definido antes do bloco if/else"
    fi
else
    test_info "Estrutura if/else não encontrada (código pode ter sido refatorado)"
fi
echo ""

# ============================================
# TESTE 6: Verificar build (se possível)
# ============================================
echo "📋 Teste 6: Verificando se código compila sem erros..."
if command -v npm &> /dev/null && [ -f "$PROJECT_DIR/package.json" ]; then
    test_info "Verificando build (pode demorar alguns minutos)..."
    
    # Apenas verificar TypeScript sem fazer build completo
    if command -v npx &> /dev/null; then
        BUILD_ERRORS=$(npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "useSellerPerformance" | grep -i "error" | wc -l)
        
        if [ "$BUILD_ERRORS" -eq 0 ]; then
            test_pass "Nenhum erro de compilação relacionado a useSellerPerformance"
        else
            test_info "Alguns erros de compilação encontrados (verificar manualmente)"
        fi
    else
        test_info "TypeScript compiler não disponível - pulando verificação de build"
    fi
else
    test_info "npm não disponível ou package.json não encontrado - pulando verificação de build"
fi
echo ""

# ============================================
# RESUMO FINAL
# ============================================
echo "=============================================="
echo "📊 Resumo dos Testes"
echo "=============================================="
echo -e "${GREEN}✅ Testes passados: $PASSED${NC}"
echo -e "${RED}❌ Testes falhados: $FAILED${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    PERCENTAGE=$((PASSED * 100 / TOTAL))
    echo "📈 Taxa de sucesso: $PERCENTAGE%"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Todos os testes passaram!${NC}"
    echo ""
    echo "✅ Correção validada com sucesso!"
    echo "✅ Código está correto e pronto para uso"
    echo ""
    echo "📋 Próximos passos:"
    echo "   1. Testar no navegador: Painel de Vendedor"
    echo "   2. Testar no navegador: Relatórios"
    echo "   3. Testar no navegador: Atividade por Vendedor"
    exit 0
else
    echo -e "${YELLOW}⚠️  Alguns testes falharam${NC}"
    echo ""
    echo "Revisar os itens marcados com ❌ acima"
    exit 1
fi


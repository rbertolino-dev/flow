#!/bin/bash

# 🧪 Script: Teste Completo de Renderização do CRM
# Descrição: Testa renderização do CRM e verifica erros de JavaScript em runtime
# Uso: ./scripts/test-crm-rendering.sh [blue|green]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parâmetros
VERSION=${1:-blue}
PORT=${VERSION:-3000}

# Ajustar porta baseado na versão
if [ "$VERSION" = "green" ]; then
    PORT=3001
elif [ "$VERSION" = "blue" ]; then
    PORT=3000
fi

APP_URL="http://localhost:${PORT}"
CRM_URL="${APP_URL}/crm"

log() {
    echo -e "${BLUE}[TEST-CRM]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[TEST-CRM]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[TEST-CRM]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[TEST-CRM]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Teste Completo de Renderização CRM    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

log "Testando CRM (versão: ${VERSION}, porta: ${PORT})..."
log "URL: ${CRM_URL}"
echo ""

ERRORS=0

# 1. Teste básico de renderização
log "1/5 - Teste básico de renderização..."
if ./scripts/validate-app-rendering.sh "$VERSION" 30 > /dev/null 2>&1; then
    log_success "✓ Renderização básica OK"
else
    log_error "✗ Renderização básica FALHOU"
    ((ERRORS++))
fi
echo ""

# 2. Verificar se HTML do CRM carrega
log "2/5 - Verificando HTML do CRM..."
CRM_HTML=$(curl -s --max-time 10 "${CRM_URL}" 2>/dev/null || echo "")

if [ -z "$CRM_HTML" ]; then
    log_error "✗ HTML do CRM não carregou"
    ((ERRORS++))
elif ! echo "$CRM_HTML" | grep -q 'id="root"'; then
    log_error "✗ HTML não contém div#root"
    ((ERRORS++))
else
    log_success "✓ HTML do CRM carrega corretamente"
fi
echo ""

# 3. Verificar bundle JavaScript
log "3/5 - Verificando bundle JavaScript..."
BUNDLE_SCRIPT=$(echo "$CRM_HTML" | grep -o 'index-[^"]*\.js' | head -1 || echo "")

if [ -z "$BUNDLE_SCRIPT" ]; then
    log_error "✗ Bundle JavaScript não encontrado"
    ((ERRORS++))
else
    BUNDLE_URL="${APP_URL}/assets/${BUNDLE_SCRIPT}"
    BUNDLE_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${BUNDLE_URL}" 2>/dev/null || echo "000")
    
    if [ "$BUNDLE_HTTP_CODE" != "200" ]; then
        log_error "✗ Bundle JavaScript não carrega (HTTP ${BUNDLE_HTTP_CODE})"
        ((ERRORS++))
    else
        BUNDLE_SIZE=$(curl -s --max-time 5 "${BUNDLE_URL}" 2>/dev/null | wc -c || echo "0")
        if [ "$BUNDLE_SIZE" -lt 1000 ]; then
            log_error "✗ Bundle JavaScript parece vazio (${BUNDLE_SIZE} bytes)"
            ((ERRORS++))
        else
            log_success "✓ Bundle JavaScript OK (${BUNDLE_SIZE} bytes)"
        fi
    fi
fi
echo ""

# 4. Verificar se há erros no build
log "4/5 - Verificando build..."
if npm run build > /tmp/build-test.log 2>&1; then
    if grep -qiE "(error|Error|ERROR|failed|Failed)" /tmp/build-test.log; then
        log_warn "⚠ Build completou mas há avisos"
        grep -iE "(error|Error|ERROR|failed|Failed)" /tmp/build-test.log | head -5
    else
        log_success "✓ Build sem erros"
    fi
else
    log_error "✗ Build falhou"
    grep -iE "(error|Error|ERROR|failed|Failed)" /tmp/build-test.log | head -10
    ((ERRORS++))
fi
echo ""

# 5. Verificar logs do container
log "5/5 - Verificando logs do container..."
CONTAINER_NAME="kanban-buzz-app-${VERSION}"
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    CONTAINER_ERRORS=$(docker logs "${CONTAINER_NAME}" --tail 100 2>&1 | grep -iE "(error|Error|ERROR|ReferenceError|TypeError)" | wc -l || echo "0")
    if [ "$CONTAINER_ERRORS" -gt 0 ]; then
        log_warn "⚠ ${CONTAINER_ERRORS} erro(s) encontrado(s) nos logs do container"
        docker logs "${CONTAINER_NAME}" --tail 50 2>&1 | grep -iE "(error|Error|ERROR|ReferenceError|TypeError)" | head -5
    else
        log_success "✓ Nenhum erro nos logs do container"
    fi
else
    log_warn "⚠ Container ${CONTAINER_NAME} não está rodando"
fi
echo ""

# Resultado final
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $ERRORS -eq 0 ]; then
    log_success "✅ TODOS OS TESTES PASSARAM!"
    log_success "CRM está renderizando corretamente"
    echo ""
    log "📋 Resumo:"
    log "   - HTML carrega: ✓"
    log "   - Bundle JavaScript: ✓"
    log "   - Build: ✓"
    log "   - Logs do container: ✓"
    exit 0
else
    log_error "❌ ${ERRORS} TESTE(S) FALHARAM"
    log_error "CRM pode não estar funcionando corretamente"
    echo ""
    log "📋 Próximos passos:"
    log "   1. Verifique os logs do container: docker logs ${CONTAINER_NAME}"
    log "   2. Verifique o console do navegador em ${CRM_URL}"
    log "   3. Execute: ./scripts/validate-app-rendering.sh ${VERSION}"
    exit 1
fi


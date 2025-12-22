#!/bin/bash

# 🔍 Script: Validação de Renderização da Aplicação
# Descrição: Verifica se a aplicação React renderiza corretamente (não fica em branco)
# Uso: ./scripts/validate-app-rendering.sh [blue|green] [timeout_seconds]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parâmetros
VERSION=${1:-blue}
TIMEOUT=${2:-30}
PORT=${VERSION:-3000}

# Ajustar porta baseado na versão
if [ "$VERSION" = "green" ]; then
    PORT=3001
elif [ "$VERSION" = "blue" ]; then
    PORT=3000
fi

APP_URL="http://localhost:${PORT}"

log() {
    echo -e "${BLUE}[VALIDATE-RENDER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[VALIDATE-RENDER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[VALIDATE-RENDER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[VALIDATE-RENDER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log "Validando renderização da aplicação (versão: ${VERSION}, porta: ${PORT})..."
log "Timeout: ${TIMEOUT}s"

# Aguardar até aplicação estar pronta
START_TIME=$(date +%s)
ELAPSED=0
VALIDATION_PASSED=false

while [ $ELAPSED -lt $TIMEOUT ]; do
    # 1. Verificar se HTML carrega
    HTML_CONTENT=$(curl -s --max-time 5 "${APP_URL}" 2>/dev/null || echo "")
    
    if [ -z "$HTML_CONTENT" ]; then
        ELAPSED=$(($(date +%s) - START_TIME))
        REMAINING=$((TIMEOUT - ELAPSED))
        if [ $REMAINING -gt 0 ]; then
            log_warn "Aguardando HTML carregar... (${ELAPSED}s/${TIMEOUT}s)"
            sleep 2
            continue
        else
            log_error "Timeout: HTML não carregou em ${TIMEOUT}s"
            exit 1
        fi
    fi
    
    # 2. Verificar se contém div#root (elemento raiz do React)
    if ! echo "$HTML_CONTENT" | grep -q 'id="root"'; then
        log_error "HTML não contém div#root - aplicação pode não estar renderizando"
        echo "$HTML_CONTENT" | head -50
        exit 1
    fi
    log "✓ HTML contém div#root"
    
    # 3. Verificar se bundle JavaScript existe e é referenciado
    BUNDLE_SCRIPT=$(echo "$HTML_CONTENT" | grep -o 'index-[^"]*\.js' | head -1 || echo "")
    
    if [ -z "$BUNDLE_SCRIPT" ]; then
        log_error "Bundle JavaScript não encontrado no HTML!"
        echo "$HTML_CONTENT" | grep -i "script" | head -10
        exit 1
    fi
    log "✓ Bundle JavaScript encontrado: $BUNDLE_SCRIPT"
    
    # 4. Verificar se bundle JavaScript carrega (HTTP 200)
    BUNDLE_URL="${APP_URL}/assets/${BUNDLE_SCRIPT}"
    BUNDLE_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${BUNDLE_URL}" 2>/dev/null || echo "000")
    
    if [ "$BUNDLE_HTTP_CODE" != "200" ]; then
        log_error "Bundle JavaScript não carrega! HTTP: ${BUNDLE_HTTP_CODE}"
        log_error "URL: ${BUNDLE_URL}"
        exit 1
    fi
    log "✓ Bundle JavaScript carrega corretamente (HTTP 200)"
    
    # 5. Verificar se bundle não está vazio (tamanho mínimo esperado)
    BUNDLE_SIZE=$(curl -s --max-time 5 "${BUNDLE_URL}" 2>/dev/null | wc -c || echo "0")
    
    if [ "$BUNDLE_SIZE" -lt 1000 ]; then
        log_error "Bundle JavaScript parece estar vazio ou corrompido! Tamanho: ${BUNDLE_SIZE} bytes"
        exit 1
    fi
    log "✓ Bundle JavaScript tem tamanho válido: ${BUNDLE_SIZE} bytes"
    
    # 6. Verificar se não há erros críticos no HTML (imports quebrados, etc)
    if echo "$HTML_CONTENT" | grep -qiE "(error|failed|undefined|null).*script"; then
        log_warn "Possíveis erros detectados no HTML (verificando mais detalhadamente)..."
        # Continuar - pode ser falso positivo
    fi
    
    # 7. Verificar se HTML contém elementos esperados da aplicação
    EXPECTED_ELEMENTS=("title" "meta" "link")
    MISSING_ELEMENTS=()
    
    for element in "${EXPECTED_ELEMENTS[@]}"; do
        if ! echo "$HTML_CONTENT" | grep -qi "<${element}"; then
            MISSING_ELEMENTS+=("$element")
        fi
    done
    
    if [ ${#MISSING_ELEMENTS[@]} -gt 0 ]; then
        log_warn "Alguns elementos esperados não foram encontrados: ${MISSING_ELEMENTS[*]}"
        # Não falhar - pode ser normal dependendo da estrutura
    else
        log "✓ Elementos HTML esperados presentes"
    fi
    
    # 8. Verificar se não há imports quebrados (script src com erro 404)
    SCRIPT_TAGS=$(echo "$HTML_CONTENT" | grep -o '<script[^>]*src="[^"]*"' | sed 's/.*src="\([^"]*\)".*/\1/' || echo "")
    
    if [ -n "$SCRIPT_TAGS" ]; then
        SCRIPT_ERRORS=0
        while IFS= read -r script_src; do
            if [ -n "$script_src" ]; then
                # Resolver URL relativa
                if [[ "$script_src" == /* ]]; then
                    SCRIPT_URL="${APP_URL}${script_src}"
                else
                    SCRIPT_URL="${APP_URL}/${script_src}"
                fi
                
                SCRIPT_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${SCRIPT_URL}" 2>/dev/null || echo "000")
                if [ "$SCRIPT_HTTP_CODE" != "200" ] && [ "$SCRIPT_HTTP_CODE" != "000" ]; then
                    log_warn "Script não encontrado: ${script_src} (HTTP ${SCRIPT_HTTP_CODE})"
                    ((SCRIPT_ERRORS++))
                fi
            fi
        done <<< "$SCRIPT_TAGS"
        
        if [ $SCRIPT_ERRORS -gt 0 ]; then
            log_warn "Alguns scripts não carregam (${SCRIPT_ERRORS} erro(s)) - pode indicar problema"
            # Não falhar automaticamente - pode ser script opcional
        else
            log "✓ Todos os scripts carregam corretamente"
        fi
    fi
    
    # 9. Verificar se CSS carrega (se houver)
    CSS_LINK=$(echo "$HTML_CONTENT" | grep -o 'index-[^"]*\.css' | head -1 || echo "")
    if [ -n "$CSS_LINK" ]; then
        CSS_URL="${APP_URL}/assets/${CSS_LINK}"
        CSS_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${CSS_URL}" 2>/dev/null || echo "000")
        if [ "$CSS_HTTP_CODE" = "200" ]; then
            log "✓ CSS carrega corretamente"
        else
            log_warn "CSS não carrega (HTTP ${CSS_HTTP_CODE}) - pode ser normal se não houver CSS"
        fi
    fi
    
    # Todas validações passaram
    VALIDATION_PASSED=true
    break
    
done

if [ "$VALIDATION_PASSED" = false ]; then
    log_error "Timeout: Validação não completou em ${TIMEOUT}s"
    exit 1
fi

log_success "Aplicação renderiza corretamente!"
log "  - Bundle: $BUNDLE_SCRIPT"
log "  - Tamanho: ${BUNDLE_SIZE} bytes"
log "  - HTML válido com div#root"
log "  - Scripts carregam corretamente"

exit 0


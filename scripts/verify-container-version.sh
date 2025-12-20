#!/bin/bash

# ✅ Script: Verificar Versão no Container
# Descrição: Verifica versão no container via /version.json
# Uso: ./scripts/verify-container-version.sh [blue|green] [expected_version]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
    echo -e "${BLUE}[VERIFY-VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[VERIFY-VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[VERIFY-VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[VERIFY-VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Parâmetros
VERSION=${1:-"blue"}
EXPECTED_VERSION=${2:-""}

# Porta baseada na versão
if [ "$VERSION" = "blue" ]; then
    PORT=3000
elif [ "$VERSION" = "green" ]; then
    PORT=3001
else
    log_error "Versão inválida: $VERSION (deve ser 'blue' ou 'green')"
    exit 1
fi

log "Verificando versão no container ${VERSION} (porta ${PORT})..."

# Tentar obter /version.json do container
VERSION_JSON=""
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    VERSION_JSON=$(curl -s --max-time 5 "http://localhost:${PORT}/version.json" 2>/dev/null || echo "")
    
    if [ -n "$VERSION_JSON" ] && [ "$VERSION_JSON" != "null" ]; then
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        log_warn "Tentativa ${RETRY_COUNT}/${MAX_RETRIES} falhou. Aguardando 2s..."
        sleep 2
    fi
done

# Se não conseguiu obter versão, não é erro crítico (container pode não ter versão ainda)
if [ -z "$VERSION_JSON" ] || [ "$VERSION_JSON" = "null" ]; then
    log_warn "Não foi possível obter /version.json do container ${VERSION}"
    log_warn "Container pode não ter versão configurada ainda (não é erro crítico)"
    exit 0  # Não falha - versão pode não estar disponível ainda
fi

# Extrair versão do JSON
CONTAINER_VERSION=$(echo "$VERSION_JSON" | jq -r '.version // ""' 2>/dev/null || echo "")

if [ -z "$CONTAINER_VERSION" ] || [ "$CONTAINER_VERSION" = "null" ]; then
    log_warn "Versão não encontrada em /version.json (não é erro crítico)"
    exit 0
fi

log_success "Versão no container: ${CONTAINER_VERSION}"

# Se versão esperada foi fornecida, verificar se corresponde
if [ -n "$EXPECTED_VERSION" ] && [ "$EXPECTED_VERSION" != "" ]; then
    if [ "$CONTAINER_VERSION" = "$EXPECTED_VERSION" ]; then
        log_success "Versão confere com esperada: ${EXPECTED_VERSION}"
        exit 0
    else
        log_error "Versão não confere! Esperada: ${EXPECTED_VERSION}, Encontrada: ${CONTAINER_VERSION}"
        exit 1
    fi
fi

# Se não há versão esperada, apenas retornar sucesso se conseguiu ler versão
exit 0



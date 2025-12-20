#!/bin/bash

# 🏥 Script: Health Check para Containers
# Descrição: Verifica se um container está saudável e respondendo
# Uso: ./scripts/health-check.sh [blue|green] [timeout_seconds]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parâmetros
VERSION=${1:-blue}
TIMEOUT=${2:-60}
PORT=${VERSION:-3000}

# Ajustar porta baseado na versão
if [ "$VERSION" = "green" ]; then
    PORT=3001
elif [ "$VERSION" = "blue" ]; then
    PORT=3000
fi

CONTAINER_NAME="kanban-buzz-app-${VERSION}"
HEALTH_URL="http://localhost:${PORT}/health"

log() {
    echo -e "${BLUE}[HEALTH-CHECK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[HEALTH-CHECK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[HEALTH-CHECK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[HEALTH-CHECK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Verificar se container existe
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_error "Container ${CONTAINER_NAME} não encontrado"
    exit 1
fi

# Verificar se container está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_error "Container ${CONTAINER_NAME} não está rodando"
    exit 1
fi

log "Verificando saúde de ${CONTAINER_NAME} (porta ${PORT})..."
log "Timeout: ${TIMEOUT}s"

# Aguardar até container estar saudável
START_TIME=$(date +%s)
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    # Verificar health check do Docker
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "none")
    
    # Verificar endpoint HTTP
    HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${HEALTH_URL}" 2>/dev/null || echo "000")
    
    if [ "$HTTP_RESPONSE" = "200" ] && [ "$HEALTH_STATUS" != "unhealthy" ]; then
        log_success "Container ${CONTAINER_NAME} está saudável!"
        log "  - HTTP Status: ${HTTP_RESPONSE}"
        log "  - Docker Health: ${HEALTH_STATUS}"
        exit 0
    fi
    
    ELAPSED=$(($(date +%s) - START_TIME))
    REMAINING=$((TIMEOUT - ELAPSED))
    
    if [ $REMAINING -gt 0 ]; then
        log_warn "Aguardando... (${ELAPSED}s/${TIMEOUT}s) - HTTP: ${HTTP_RESPONSE}, Health: ${HEALTH_STATUS}"
        sleep 5
    fi
done

log_error "Timeout: Container ${CONTAINER_NAME} não ficou saudável em ${TIMEOUT}s"
log "  - HTTP Status: ${HTTP_RESPONSE}"
log "  - Docker Health: ${HEALTH_STATUS}"

# Mostrar logs recentes em caso de falha
log "Últimos logs do container:"
docker logs --tail=20 "${CONTAINER_NAME}" 2>&1 || true

exit 1






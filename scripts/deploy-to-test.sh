#!/bin/bash

# 🧪 Script: Deploy para Ambiente de Teste
# Descrição: Faz deploy no ambiente de teste (porta 3002) para desenvolvimento
# Uso: ./scripts/deploy-to-test.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_CHECK="$SCRIPT_DIR/health-check.sh"

log() {
    echo -e "${BLUE}[TEST-DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[TEST-DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[TEST-DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[TEST-DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

cd "$PROJECT_DIR"

log "=========================================="
log "🧪 Deploy para Ambiente de Teste"
log "=========================================="
log ""

# Verificar pré-requisitos
log "1/5 - Verificando pré-requisitos..."

if ! command -v docker &> /dev/null; then
    log_error "Docker não está instalado"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    log_error "Docker Compose não está instalado"
    exit 1
fi

log_success "Pré-requisitos OK"

# Build da versão de teste
log "2/5 - Fazendo build da versão de teste..."
log "  Isso pode levar alguns minutos..."

docker compose -f docker-compose.test.yml build --no-cache || {
    log_error "Build falhou!"
    exit 1
}

log_success "Build concluído"

# Subir versão de teste
log "3/5 - Subindo versão de teste (porta 3002)..."

docker compose -f docker-compose.test.yml up -d || {
    log_error "Falha ao subir container de teste"
    exit 1
}

log_success "Container de teste iniciado"

# Health check
log "4/5 - Aguardando versão de teste ficar saudável (timeout: 90s)..."

# Criar health check temporário para teste
TEST_HEALTH_CHECK() {
    local max_attempts=18
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s --max-time 5 "http://localhost:3002/health" >/dev/null 2>&1; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 5
    done
    
    return 1
}

if TEST_HEALTH_CHECK; then
    log_success "Versão de teste está saudável!"
else
    log_error "Versão de teste não ficou saudável"
    exit 1
fi

# Resumo final
log ""
log "5/5 - Resumo do deploy de teste"
log "=========================================="
log_success "✅ Deploy para ambiente de teste concluído!"
log ""
log "Ambiente de teste:"
log "  - URL: http://localhost:3002"
log "  - Container: kanban-buzz-app-test"
log "  - Porta: 3002"
log ""
log "Comandos úteis:"
log "  - Ver logs: docker compose -f docker-compose.test.yml logs -f"
log "  - Status: docker compose -f docker-compose.test.yml ps"
log "  - Parar: docker compose -f docker-compose.test.yml down"
log "  - Rebuild: docker compose -f docker-compose.test.yml build --no-cache"
log ""

exit 0






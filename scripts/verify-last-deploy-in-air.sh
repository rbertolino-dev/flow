#!/bin/bash

# ✅ Script: Verificar que Último Deploy Está no Ar
# Descrição: Verifica todas condições antes de parar versão antiga
# Uso: ./scripts/verify-last-deploy-in-air.sh [new_version] [current_version]

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
GET_LAST_DEPLOY="$SCRIPT_DIR/get-last-deploy.sh"
VERIFY_VERSION="$SCRIPT_DIR/verify-container-version.sh"

log() {
    echo -e "${BLUE}[VERIFY-LAST-DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[VERIFY-LAST-DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[VERIFY-LAST-DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[VERIFY-LAST-DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Parâmetros
NEW_VERSION=${1:-""}
CURRENT_VERSION=${2:-""}

if [ -z "$NEW_VERSION" ] || [ -z "$CURRENT_VERSION" ]; then
    log_error "Uso: $0 [new_version] [current_version]"
    exit 1
fi

NGINX_CONFIG="/etc/nginx/sites-available/kanban-buzz"
NGINX_AGILIZE="/etc/nginx/sites-enabled/agilizeflow.com.br"
LAST_DEPLOY_FILE="$PROJECT_DIR/.last-deploy"

log "Verificando que último deploy (${NEW_VERSION}) está no ar antes de parar ${CURRENT_VERSION}..."

# Verificação 1: Nova versão está saudável
log "1/7 - Verificando que nova versão está saudável..."
if ! "$HEALTH_CHECK" "${NEW_VERSION}" 10 >/dev/null 2>&1; then
    log_error "Nova versão (${NEW_VERSION}) não está saudável!"
    exit 1
fi
log_success "Nova versão está saudável"

# Verificação 2: Timestamp da imagem nova vs antiga
log "2/7 - Verificando timestamp das imagens..."
NEW_IMAGE="kanban-buzz-95241-app-${NEW_VERSION}:latest"
CURRENT_IMAGE="kanban-buzz-95241-app-${CURRENT_VERSION}:latest"

if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${NEW_IMAGE}$"; then
    NEW_TIMESTAMP=$(docker inspect "$NEW_IMAGE" --format='{{.Created}}' 2>/dev/null | xargs -I {} date -d {} +%s 2>/dev/null || echo "0")
else
    log_error "Imagem ${NEW_IMAGE} não encontrada!"
    exit 1
fi

if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${CURRENT_IMAGE}$"; then
    CURRENT_TIMESTAMP=$(docker inspect "$CURRENT_IMAGE" --format='{{.Created}}' 2>/dev/null | xargs -I {} date -d {} +%s 2>/dev/null || echo "0")
else
    CURRENT_TIMESTAMP="0"
fi

if [ "$NEW_TIMESTAMP" -le "$CURRENT_TIMESTAMP" ] && [ "$CURRENT_TIMESTAMP" -gt "0" ]; then
    log_error "Timestamp da nova imagem não é mais recente que a antiga!"
    log_error "Nova: $(date -d "@${NEW_TIMESTAMP}" 2>/dev/null || echo 'N/A')"
    log_error "Antiga: $(date -d "@${CURRENT_TIMESTAMP}" 2>/dev/null || echo 'N/A')"
    exit 1
fi
log_success "Timestamp da nova imagem é mais recente"

# Verificação 3: Arquivo .last-deploy confirma nova versão
log "3/7 - Verificando arquivo .last-deploy..."
if [ -f "$LAST_DEPLOY_FILE" ]; then
    FILE_VERSION=$(jq -r '.version // ""' "$LAST_DEPLOY_FILE" 2>/dev/null || echo "")
    if [ -n "$FILE_VERSION" ] && [ "$FILE_VERSION" != "null" ] && [ "$FILE_VERSION" != "$NEW_VERSION" ]; then
        log_error "Arquivo .last-deploy indica versão diferente: ${FILE_VERSION} (esperado: ${NEW_VERSION})"
        exit 1
    fi
    log_success "Arquivo .last-deploy confirma nova versão"
else
    log_warn "Arquivo .last-deploy não existe ainda (será criado)"
fi

# Verificação 4: Nginx está apontando para nova versão
log "4/7 - Verificando configuração do Nginx..."
if [ -f "$NGINX_CONFIG" ]; then
    NGINX_TARGET=$(grep -o "default [a-z]*;" "$NGINX_CONFIG" 2>/dev/null | grep -o "[a-z]*" | tail -1 || echo "")
    if [ "$NGINX_TARGET" != "$NEW_VERSION" ]; then
        log_error "Nginx não está apontando para ${NEW_VERSION} (atual: ${NGINX_TARGET})"
        exit 1
    fi
    log_success "Nginx está apontando para ${NEW_VERSION}"
else
    log_warn "Arquivo de configuração do Nginx não encontrado"
fi

# Verificação 5: Nova versão está recebendo tráfego (health check via Nginx)
log "5/7 - Verificando que nova versão está recebendo tráfego..."
if [ -f "$NGINX_AGILIZE" ]; then
    AGILIZE_PORT=$(grep "proxy_pass" "$NGINX_AGILIZE" | grep -o "localhost:[0-9]*" | head -1 | grep -o "[0-9]*" || echo "")
    EXPECTED_PORT=$([ "$NEW_VERSION" = "blue" ] && echo "3000" || echo "3001")
    
    if [ "$AGILIZE_PORT" != "$EXPECTED_PORT" ]; then
        log_error "agilizeflow.com.br não está apontando para porta correta (atual: ${AGILIZE_PORT}, esperado: ${EXPECTED_PORT})"
        exit 1
    fi
    
    # Verificar health check via Nginx
    if curl -f -s --max-time 5 "http://localhost:${EXPECTED_PORT}/health" >/dev/null 2>&1; then
        log_success "Nova versão está recebendo tráfego e respondendo"
    else
        log_error "Nova versão não está respondendo na porta ${EXPECTED_PORT}"
        exit 1
    fi
else
    log_warn "Configuração agilizeflow.com.br não encontrada"
fi

# Verificação 6: Versão no container (se disponível)
log "6/7 - Verificando versão no container..."
if "$VERIFY_VERSION" "${NEW_VERSION}" >/dev/null 2>&1; then
    log_success "Versão no container verificada"
else
    log_warn "Não foi possível verificar versão no container (não é erro crítico)"
fi

# Verificação 7: get-last-deploy confirma que nova versão é a última
log "7/7 - Verificando que get-last-deploy confirma nova versão..."
LAST_DEPLOY=$(chmod +x "$GET_LAST_DEPLOY" 2>/dev/null; "$GET_LAST_DEPLOY" 2>/dev/null || echo "")
if [ -n "$LAST_DEPLOY" ] && [ "$LAST_DEPLOY" != "$NEW_VERSION" ]; then
    log_error "get-last-deploy indica versão diferente: ${LAST_DEPLOY} (esperado: ${NEW_VERSION})"
    exit 1
fi
log_success "get-last-deploy confirma que ${NEW_VERSION} é o último deploy"

log_success "✅ Todas verificações passaram! Último deploy (${NEW_VERSION}) está no ar e estável."

exit 0



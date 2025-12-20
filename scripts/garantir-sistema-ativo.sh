#!/bin/bash

# 🛡️ Script: Garantir Sistema Sempre Ativo
# Descrição: Verifica e garante que sempre há um container respondendo
# Uso: ./scripts/garantir-sistema-ativo.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_CHECK="$SCRIPT_DIR/health-check.sh"

log() {
    echo -e "${BLUE}[GARANTIR-ATIVO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[GARANTIR-ATIVO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[GARANTIR-ATIVO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[GARANTIR-ATIVO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

cd "$PROJECT_DIR"

# Verificar se Blue está rodando e saudável
BLUE_OK=false
if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-blue"; then
    if "$HEALTH_CHECK" blue 5 >/dev/null 2>&1; then
        BLUE_OK=true
        log "Blue está rodando e saudável"
    else
        log_warn "Blue está rodando mas não está saudável"
    fi
fi

# Verificar se Green está rodando e saudável
GREEN_OK=false
if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
    if "$HEALTH_CHECK" green 5 >/dev/null 2>&1; then
        GREEN_OK=true
        log "Green está rodando e saudável"
    else
        log_warn "Green está rodando mas não está saudável"
    fi
fi

# Se nenhum está OK, restaurar Blue
if [ "$BLUE_OK" = false ] && [ "$GREEN_OK" = false ]; then
    log_error "Nenhum container está saudável! Restaurando Blue..."
    
    # Parar tudo
    docker compose -f docker-compose.blue.yml down 2>/dev/null || true
    docker compose -f docker-compose.green.yml down 2>/dev/null || true
    
    # Remover containers antigos
    docker ps -a --format '{{.Names}}' | grep -E "^kanban-buzz-app$" | while read container; do
        docker stop "$container" 2>/dev/null || true
        docker rm "$container" 2>/dev/null || true
    done
    
    # Iniciar Blue
    log "Iniciando Blue..."
    docker compose -f docker-compose.blue.yml up -d
    
    # Aguardar e verificar
    sleep 10
    if "$HEALTH_CHECK" blue 60; then
        log_success "Blue restaurado e saudável!"
        
        # Atualizar Nginx para Blue
        if [ -f "/etc/nginx/sites-available/kanban-buzz" ]; then
            sudo sed -i "s/default [a-z]*;/default blue;/" /etc/nginx/sites-available/kanban-buzz
            sudo nginx -t && sudo systemctl reload nginx
            log_success "Nginx atualizado para Blue"
        fi
    else
        log_error "Falha ao restaurar Blue"
        exit 1
    fi
elif [ "$BLUE_OK" = true ] && [ "$GREEN_OK" = false ]; then
    log_success "Blue está OK - sistema funcionando"
elif [ "$GREEN_OK" = true ] && [ "$BLUE_OK" = false ]; then
    log_success "Green está OK - sistema funcionando"
else
    log_success "Ambas versões estão OK - sistema funcionando perfeitamente"
fi

# Verificar Nginx
if curl -s -o /dev/null -w "%{http_code}" http://localhost/health | grep -q "200\|301"; then
    log_success "Nginx está respondendo corretamente"
else
    log_warn "Nginx pode não estar respondendo corretamente"
fi

log_success "Verificação concluída - sistema está ativo"






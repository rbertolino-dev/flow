#!/bin/bash

# 🚀 Script: Deploy Zero-Downtime ULTRA ROBUSTO
# Descrição: Deploy com garantias máximas - NUNCA deixa sistema sem resposta
# Uso: ./scripts/deploy-zero-downtime-ultra-robusto.sh

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
GARANTIR_ATIVO="$SCRIPT_DIR/garantir-sistema-ativo.sh"

CURRENT_VERSION="blue"
NEW_VERSION="green"
STABILITY_WAIT=30

log() {
    echo -e "${BLUE}[ULTRA-ROBUSTO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[ULTRA-ROBUSTO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ULTRA-ROBUSTO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[ULTRA-ROBUSTO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Função de emergência - GARANTE que sempre há um container respondendo
emergency_restore() {
    log_error "🚨 EMERGÊNCIA: Garantindo que sistema está ativo..."
    
    # Parar TUDO
    docker compose down 2>/dev/null || true
    docker compose -f docker-compose.blue.yml down 2>/dev/null || true
    docker compose -f docker-compose.green.yml down 2>/dev/null || true
    
    # Remover containers antigos
    docker ps -a --format '{{.Names}}' | grep -E "^kanban-buzz-app$" | while read container; do
        docker stop "$container" 2>/dev/null || true
        docker rm "$container" 2>/dev/null || true
    done
    
    # SEMPRE iniciar Blue (garantia absoluta)
    log "Iniciando Blue (garantia absoluta)..."
    docker compose -f docker-compose.blue.yml up -d
    
    # Aguardar e verificar MÚLTIPLAS vezes
    for i in {1..6}; do
        sleep 10
        if "$HEALTH_CHECK" blue 10 >/dev/null 2>&1; then
            log_success "Blue restaurado e saudável (tentativa $i)"
            
            # Atualizar Nginx
            if [ -f "/etc/nginx/sites-available/kanban-buzz" ]; then
                sudo sed -i "s/default [a-z]*;/default blue;/" /etc/nginx/sites-available/kanban-buzz 2>/dev/null || true
                sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx >/dev/null 2>&1 || true
            fi
            
            return 0
        fi
        log_warn "Tentativa $i/6: Blue ainda não está saudável..."
    done
    
    log_error "FALHA CRÍTICA: Não foi possível restaurar Blue após 6 tentativas"
    return 1
}

# Verificação CRÍTICA - sistema DEVE estar respondendo
critical_check() {
    local version=$1
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if "$HEALTH_CHECK" "$version" 5 >/dev/null 2>&1; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    return 1
}

cd "$PROJECT_DIR"

log "=========================================="
log "🚀 Deploy Zero-Downtime ULTRA ROBUSTO"
log "=========================================="
log ""

# PRÉ-VERIFICAÇÃO CRÍTICA: Sistema DEVE estar funcionando antes de começar
log "0/9 - PRÉ-VERIFICAÇÃO CRÍTICA: Sistema deve estar funcionando..."

if ! "$GARANTIR_ATIVO" >/dev/null 2>&1; then
    log_error "Sistema não está ativo! Restaurando antes de continuar..."
    emergency_restore
fi

# Verificar que pelo menos Blue está rodando e saudável
if ! critical_check "blue"; then
    log_error "Blue não está respondendo! Restaurando..."
    emergency_restore
fi

log_success "Sistema está funcionando - seguro para continuar"

# 1. Remover containers antigos (CRÍTICO)
log "1/9 - Removendo containers antigos (CRÍTICO)..."

docker ps -a --format '{{.Names}}' | grep -E "^kanban-buzz-app$" | while read container; do
    log "Removendo container antigo: $container"
    docker stop "$container" 2>/dev/null || true
    docker rm "$container" 2>/dev/null || true
done

# Verificar qual versão está rodando
BLUE_RUNNING=false
GREEN_RUNNING=false

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-blue"; then
    if critical_check "blue"; then
        BLUE_RUNNING=true
        CURRENT_VERSION="blue"
        NEW_VERSION="green"
        log "  - Blue está rodando e saudável"
    else
        log_warn "Blue está rodando mas não saudável - restaurando..."
        emergency_restore
        BLUE_RUNNING=true
        CURRENT_VERSION="blue"
        NEW_VERSION="green"
    fi
fi

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
    if critical_check "green"; then
        GREEN_RUNNING=true
        if [ "$BLUE_RUNNING" = false ]; then
            CURRENT_VERSION="green"
            NEW_VERSION="blue"
        fi
        log "  - Green está rodando e saudável"
    else
        log_warn "Green está rodando mas não saudável - removendo..."
        docker compose -f docker-compose.green.yml down 2>/dev/null || true
    fi
fi

# Se nenhuma versão está rodando, restaurar
if [ "$BLUE_RUNNING" = false ] && [ "$GREEN_RUNNING" = false ]; then
    log_error "Nenhuma versão está rodando! Restaurando..."
    emergency_restore
    CURRENT_VERSION="blue"
    NEW_VERSION="green"
fi

log "  - Versão atual: ${CURRENT_VERSION}"
log "  - Nova versão: ${NEW_VERSION}"

# 2. Build de AMBAS versões (CRÍTICO: garantir que ambas estão atualizadas)
log "2/9 - Fazendo build de AMBAS versões (garantir código atualizado)..."

# Verificar que versão atual AINDA está respondendo antes de build
if ! critical_check "${CURRENT_VERSION}"; then
    log_error "Versão atual parou de responder durante build! Restaurando..."
    emergency_restore
    exit 1
fi

# CRÍTICO: Rebuildar AMBAS versões para garantir código atualizado
# Isso evita que uma versão fique com código antigo
log "  - Rebuildando ${CURRENT_VERSION} (versão atual)..."
docker compose -f docker-compose.${CURRENT_VERSION}.yml build --no-cache || {
    log_error "Build de ${CURRENT_VERSION} falhou!"
    if ! critical_check "${CURRENT_VERSION}"; then
        emergency_restore
    fi
    exit 1
}

log "  - Rebuildando ${NEW_VERSION} (nova versão)..."
docker compose -f docker-compose.${NEW_VERSION}.yml build --no-cache || {
    log_error "Build de ${NEW_VERSION} falhou!"
    # Verificar que atual ainda está OK
    if ! critical_check "${CURRENT_VERSION}"; then
        emergency_restore
    fi
    exit 1
}

log_success "Build de AMBAS versões concluído (código garantidamente atualizado)"

# 3. Verificar que atual AINDA está OK antes de subir nova
log "3/9 - Verificando que versão atual ainda está OK..."

if ! critical_check "${CURRENT_VERSION}"; then
    log_error "Versão atual parou de responder! Restaurando..."
    emergency_restore
    exit 1
fi

# 4. Subir nova versão
log "4/9 - Subindo nova versão (${NEW_VERSION}) na porta alternativa..."

docker compose -f docker-compose.${NEW_VERSION}.yml up -d || {
    log_error "Falha ao subir ${NEW_VERSION}"
    # Verificar que atual ainda está OK
    if ! critical_check "${CURRENT_VERSION}"; then
        emergency_restore
    fi
    exit 1
}

log_success "Container ${NEW_VERSION} iniciado"

# 5. Health check MÚLTIPLO e ROBUSTO
log "5/9 - Health check ROBUSTO da nova versão..."

for i in {1..5}; do
    log "Verificação $i/5..."
    if "$HEALTH_CHECK" "${NEW_VERSION}" 30 >/dev/null 2>&1; then
        log_success "Verificação $i/5: OK"
        sleep 3
    else
        log_error "Verificação $i/5: FALHOU"
        if [ $i -eq 5 ]; then
            log_error "Nova versão não ficou saudável após 5 tentativas"
            # Verificar que atual ainda está OK
            if ! critical_check "${CURRENT_VERSION}"; then
                emergency_restore
            else
                log "Versão atual ainda está OK - removendo nova versão problemática"
                docker compose -f docker-compose.${NEW_VERSION}.yml down
            fi
            exit 1
        fi
        sleep 5
    fi
done

log_success "Nova versão está saudável (5 verificações OK)!"

# 6. Verificar que atual AINDA está OK antes de alternar
log "6/9 - Verificando que versão atual AINDA está OK antes de alternar..."

if ! critical_check "${CURRENT_VERSION}"; then
    log_error "Versão atual parou de responder! NÃO é seguro alternar. Restaurando..."
    emergency_restore
    exit 1
fi

# 7. Alternar tráfego (COM MÚLTIPLAS VERIFICAÇÕES)
log "7/9 - Alternando tráfego para ${NEW_VERSION}..."

NGINX_CONFIG="/etc/nginx/sites-available/kanban-buzz"

# Verificar que ambas estão rodando
if ! docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-${CURRENT_VERSION}"; then
    log_error "Versão atual não está rodando! NÃO é seguro alternar."
    emergency_restore
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-${NEW_VERSION}"; then
    log_error "Nova versão não está rodando! NÃO é seguro alternar."
    emergency_restore
    exit 1
fi

# Atualizar Nginx
sudo sed -i "s/default [a-z]*;/default ${NEW_VERSION};/" "$NGINX_CONFIG" || {
    log_error "Falha ao atualizar Nginx"
    emergency_restore
    exit 1
}

# Testar ANTES de recarregar
if ! sudo nginx -t; then
    log_error "Configuração Nginx inválida - revertendo"
    sudo sed -i "s/default ${NEW_VERSION};/default ${CURRENT_VERSION};/" "$NGINX_CONFIG"
    emergency_restore
    exit 1
fi

# Recarregar
sudo systemctl reload nginx || sudo nginx -s reload || {
    log_error "Falha ao recarregar Nginx - revertendo"
    sudo sed -i "s/default ${NEW_VERSION};/default ${CURRENT_VERSION};/" "$NGINX_CONFIG"
    emergency_restore
    exit 1
}

log_success "Nginx recarregado"

# Verificar que nova versão está recebendo tráfego
sleep 5
if ! critical_check "${NEW_VERSION}"; then
    log_error "Nova versão não está respondendo após alternância! Revertendo..."
    sudo sed -i "s/default ${NEW_VERSION};/default ${CURRENT_VERSION};/" "$NGINX_CONFIG"
    sudo systemctl reload nginx
    emergency_restore
    exit 1
fi

log_success "Nova versão está recebendo tráfego"

# 8. Verificações de estabilidade MÚLTIPLAS
log "8/9 - Verificações de estabilidade (3x)..."

for i in {1..3}; do
    sleep 10
    if ! critical_check "${NEW_VERSION}"; then
        log_error "Nova versão não estável (verificação $i/3) - revertendo..."
        sudo sed -i "s/default ${NEW_VERSION};/default ${CURRENT_VERSION};/" "$NGINX_CONFIG"
        sudo systemctl reload nginx
        emergency_restore
        exit 1
    fi
    log "Verificação de estabilidade $i/3: OK"
done

log_success "Nova versão estável (3 verificações OK)!"

# 9. Parar versão antiga (APENAS após confirmar estabilidade)
log "9/9 - Parando versão antiga (${CURRENT_VERSION})..."

# Última verificação antes de parar
if ! critical_check "${NEW_VERSION}"; then
    log_error "Nova versão parou de responder! NÃO é seguro parar versão antiga."
    emergency_restore
    exit 1
fi

docker compose -f docker-compose.${CURRENT_VERSION}.yml down || {
    log_warn "Aviso: Falha ao parar ${CURRENT_VERSION} (pode não estar rodando)"
}

log_success "Versão antiga parada"

# Limpeza
docker image prune -f >/dev/null 2>&1 || true

# Verificação final
log "Verificação final..."
if ! critical_check "${NEW_VERSION}"; then
    log_error "Sistema não está respondendo após deploy! Restaurando..."
    emergency_restore
    exit 1
fi

log ""
log "=========================================="
log_success "✅ Deploy concluído com SUCESSO!"
log "=========================================="
log ""
log "Versão ativa: ${NEW_VERSION}"
log "Sistema está funcionando e estável"
log ""

exit 0






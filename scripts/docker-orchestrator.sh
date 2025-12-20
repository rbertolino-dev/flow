#!/bin/bash

# 🐳 Docker Orchestrator - Execução Sequencial de Comandos Docker
# Garante que apenas um comando Docker seja executado por vez
# Evita conflitos quando múltiplos agentes trabalham simultaneamente

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Arquivo de lock (usado pelo flock)
LOCK_FILE="/tmp/docker-orchestrator.lock"
# SEM timeout - aguarda indefinidamente até lock ser liberado

# Diretório de trabalho (pode ser local ou remoto)
WORK_DIR="${WORK_DIR:-/opt/app}"

# Função de log
log() {
    echo -e "${BLUE}[DOCKER-ORCHESTRATOR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[DOCKER-ORCHESTRATOR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - ERROR: $1" >&2
}

log_success() {
    echo -e "${GREEN}[DOCKER-ORCHESTRATOR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - SUCCESS: $1"
}

log_wait() {
    echo -e "${YELLOW}[DOCKER-ORCHESTRATOR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - WAITING: $1"
}

# Verificar se flock está disponível
if ! command -v flock &> /dev/null; then
    log_error "flock não está disponível. Instalando..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y util-linux
    elif command -v yum &> /dev/null; then
        yum install -y util-linux
    else
        log_error "Não foi possível instalar flock. Executando sem lock (não recomendado)."
        exec "$@"
    fi
fi

# Função para executar comando com lock
execute_with_lock() {
    local cmd="$*"
    local attempt=0
    local max_attempts=10
    local wait_interval=5
    
    log "Tentando adquirir lock para executar: $cmd"
    
    # Tentar adquirir lock sem bloqueio primeiro
    if flock -n 200 2>/dev/null; then
        log_success "Lock adquirido imediatamente. Executando comando..."
        
        # Executar comando dentro do diretório de trabalho
        (
            cd "$WORK_DIR" || exit 1
            eval "$cmd"
        )
        
        local exit_code=$?
        
        # Manter lock por mais 1 segundo para evitar race conditions
        sleep 1
        
        log_success "Comando executado com código de saída: $exit_code"
        return $exit_code
    else
        log_wait "Lock ocupado. Aguardando na fila (sem timeout)..."
        # Aguardar indefinidamente até lock ser liberado (sem timeout)
        flock 200
        log_success "Lock adquirido! Executando comando..."
        
        # Executar comando dentro do diretório de trabalho
        (
            cd "$WORK_DIR" || exit 1
            eval "$cmd"
        )
        
        local exit_code=$?
        
        # Manter lock por mais 1 segundo para evitar race conditions
        sleep 1
        
        log_success "Comando executado com código de saída: $exit_code"
        return $exit_code
    fi
}

# Verificar se há argumentos
if [ $# -eq 0 ]; then
    log_error "Uso: $0 <comando-docker>"
    log "Exemplos:"
    log "  $0 'docker compose down'"
    log "  $0 'docker compose build --no-cache'"
    log "  $0 'docker compose up -d'"
    log "  $0 'docker compose ps'"
    log "  $0 'docker compose logs --tail=50 app'"
    exit 1
fi

# Executar com lock usando file descriptor 200
exec 200>"$LOCK_FILE"

# Executar comando com orquestração
execute_with_lock "$@"

exit_code=$?

# Fechar file descriptor
exec 200>&-

exit $exit_code


#!/bin/bash

# 🐳 Docker Rebuild Orchestrated - Rebuild completo com orquestração
# Garante execução sequencial mesmo com múltiplos agentes

set -e

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR="$SCRIPT_DIR/docker-orchestrator.sh"

# Diretório de trabalho
WORK_DIR="${WORK_DIR:-/opt/app}"

log() {
    echo -e "${BLUE}[DOCKER-REBUILD]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[DOCKER-REBUILD]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Verificar se orchestrator existe
if [ ! -f "$ORCHESTRATOR" ]; then
    echo "Erro: docker-orchestrator.sh não encontrado em $ORCHESTRATOR"
    exit 1
fi

# Tornar executável
chmod +x "$ORCHESTRATOR"

log "Iniciando rebuild orquestrado do Docker..."

# 1. Parar containers (orquestrado)
log "1/4 - Parando containers..."
export WORK_DIR="$WORK_DIR"
"$ORCHESTRATOR" "docker compose down" || {
    log "Aviso: docker compose down falhou (pode não haver containers rodando)"
}

# 2. Build sem cache (orquestrado)
log "2/4 - Fazendo build sem cache..."
"$ORCHESTRATOR" "docker compose build --no-cache" || {
    log "Erro: Build falhou"
    exit 1
}

# 3. Subir containers (orquestrado)
log "3/4 - Subindo containers..."
"$ORCHESTRATOR" "docker compose up -d" || {
    log "Erro: Falha ao subir containers"
    exit 1
}

# 4. Verificar status (orquestrado)
log "4/4 - Verificando status..."
"$ORCHESTRATOR" "docker compose ps"

log_success "Rebuild orquestrado concluído com sucesso!"

# Mostrar logs recentes
log "Últimos logs do container app:"
"$ORCHESTRATOR" "docker compose logs --tail=50 app" || true


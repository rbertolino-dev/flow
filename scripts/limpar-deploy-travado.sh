#!/bin/bash

# 🧹 Script: Limpar Deploy Travado
# Descrição: Remove processos e locks de deploy travados
# Uso: ./scripts/limpar-deploy-travado.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[LIMPAR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[LIMPAR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[LIMPAR]${NC} $1"
}

log_error() {
    echo -e "${RED}[LIMPAR]${NC} $1"
}

log "=========================================="
log "🧹 Limpando Deploy Travado"
log "=========================================="
log ""

# 1. Matar processos de deploy travados
log "1/4 - Matando processos de deploy travados..."
DEPLOY_PIDS=$(pgrep -f "deploy-zero-downtime.sh" 2>/dev/null || true)
if [ -n "$DEPLOY_PIDS" ]; then
    echo "$DEPLOY_PIDS" | while read pid; do
        log "   Matando processo $pid..."
        kill -TERM "$pid" 2>/dev/null || true
    done
    sleep 3
    
    # Verificar se ainda estão rodando e forçar
    REMAINING=$(pgrep -f "deploy-zero-downtime.sh" 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        log_warn "   Alguns processos ainda estão rodando. Forçando..."
        echo "$REMAINING" | while read pid; do
            kill -9 "$pid" 2>/dev/null || true
        done
        sleep 2
    fi
    log_success "   Processos de deploy finalizados"
else
    log_success "   Nenhum processo de deploy encontrado"
fi

# 2. Matar processos flock relacionados
log "2/4 - Matando processos flock relacionados..."
FLOCK_PIDS=$(pgrep -f "flock.*deploy-zero-downtime" 2>/dev/null || true)
if [ -n "$FLOCK_PIDS" ]; then
    echo "$FLOCK_PIDS" | while read pid; do
        kill -9 "$pid" 2>/dev/null || true
    done
    sleep 1
    log_success "   Processos flock finalizados"
else
    log_success "   Nenhum processo flock encontrado"
fi

# 3. Verificar e limpar lock
log "3/4 - Verificando e limpando lock..."
DEPLOY_LOCK_FILE="/tmp/deploy-zero-downtime.lock"
if [ -f "$DEPLOY_LOCK_FILE" ]; then
    # Verificar se há processos realmente usando o lock
    LOCK_USERS=$(lsof "$DEPLOY_LOCK_FILE" 2>/dev/null | grep -E "deploy-zero-downtime|flock.*deploy" | awk '{print $2}' | sort -u || true)
    
    if [ -z "$LOCK_USERS" ]; then
        log "   Nenhum processo usando lock. Removendo..."
        rm -f "$DEPLOY_LOCK_FILE"
        log_success "   Lock removido"
    else
        # Verificar se processos estão realmente ativos
        ACTIVE_PROCESSES=""
        for pid in $LOCK_USERS; do
            if ps -p "$pid" >/dev/null 2>&1; then
                ACTIVE_PROCESSES="$ACTIVE_PROCESSES $pid"
            fi
        done
        
        if [ -z "$ACTIVE_PROCESSES" ]; then
            log_warn "   Lock travado com processos mortos. Removendo..."
            rm -f "$DEPLOY_LOCK_FILE"
            log_success "   Lock removido"
        else
            log_warn "   Ainda há processos ativos usando lock: $ACTIVE_PROCESSES"
            log_warn "   Removendo lock forçadamente..."
            rm -f "$DEPLOY_LOCK_FILE"
            log_success "   Lock removido forçadamente"
        fi
    fi
else
    log_success "   Lock não existe"
fi

# 4. Verificação final
log "4/4 - Verificação final..."
REMAINING_DEPLOY=$(pgrep -f "deploy-zero-downtime" 2>/dev/null || true)
if [ -z "$REMAINING_DEPLOY" ]; then
    log_success "   ✅ Nenhum processo de deploy encontrado"
else
    log_warn "   ⚠️ Ainda há processos: $REMAINING_DEPLOY"
fi

if [ ! -f "$DEPLOY_LOCK_FILE" ]; then
    log_success "   ✅ Lock foi removido"
else
    log_warn "   ⚠️ Lock ainda existe"
fi

log ""
log "=========================================="
log_success "✅ Limpeza concluída!"
log "=========================================="
log ""
log "Agora você pode tentar fazer deploy novamente:"
log "  ./scripts/deploy-zero-downtime.sh"
log ""

exit 0


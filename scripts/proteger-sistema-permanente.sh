#!/bin/bash

# 🛡️ Proteção Permanente do Sistema - Garante que Sistema NUNCA Fica Fora do Ar
# Descrição: Script que garante que sempre há um container rodando e saudável
# Uso: Executar via cron a cada 1 minuto

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_CHECK="$SCRIPT_DIR/health-check.sh"
LOG_FILE="/var/log/kanban-buzz-protecao-permanente.log"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERRO]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[AVISO]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cd "$PROJECT_DIR"

# Verificar e limpar lock travado antes de começar
DEPLOY_LOCK_FILE="/tmp/deploy-zero-downtime.lock"
if [ -f "$DEPLOY_LOCK_FILE" ]; then
    # Verificar se lock está travado há muito tempo (mais de 10 minutos)
    LOCK_AGE=$(find "$DEPLOY_LOCK_FILE" -mmin +10 2>/dev/null && echo "old" || echo "new")
    if [ "$LOCK_AGE" = "old" ]; then
        # Verificar se há processo de deploy realmente rodando
        DEPLOY_PIDS=$(lsof "$DEPLOY_LOCK_FILE" 2>/dev/null | grep "deploy-zero-downtime" | awk '{print $2}' | sort -u)
        if [ -z "$DEPLOY_PIDS" ]; then
            log_warn "Lock antigo detectado sem processo de deploy. Removendo lock travado..."
            rm -f "$DEPLOY_LOCK_FILE"
        else
            # Verificar se processos estão realmente ativos
            ACTIVE_DEPLOY=false
            for pid in $DEPLOY_PIDS; do
                if ps -p "$pid" >/dev/null 2>&1; then
                    ACTIVE_DEPLOY=true
                    break
                fi
            done
            if [ "$ACTIVE_DEPLOY" = false ]; then
                log_warn "Lock travado com processos mortos. Removendo lock..."
                rm -f "$DEPLOY_LOCK_FILE"
            fi
        fi
    fi
fi

# Verificar se Blue está rodando e saudável
blue_running=false
blue_healthy=false

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-blue"; then
    blue_running=true
    if "$HEALTH_CHECK" blue 5 >/dev/null 2>&1; then
        blue_healthy=true
    fi
fi

# Verificar se Green está rodando e saudável
green_running=false
green_healthy=false

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
    green_running=true
    if "$HEALTH_CHECK" green 5 >/dev/null 2>&1; then
        green_healthy=true
    fi
fi

# REGRA CRÍTICA: Sempre deve haver pelo menos um container saudável rodando
if [ "$blue_healthy" = false ] && [ "$green_healthy" = false ]; then
    log_error "CRÍTICO: Nenhum container saudável está rodando! Restaurando..."
    
    # Se Blue está rodando mas não saudável, reiniciar
    if [ "$blue_running" = true ]; then
        log "Reiniciando Blue (não saudável)..."
        docker compose -f docker-compose.blue.yml restart || true
        sleep 10
        if "$HEALTH_CHECK" blue 30 >/dev/null 2>&1; then
            log_success "Blue reiniciado e saudável"
            blue_healthy=true
        fi
    fi
    
    # Se Green está rodando mas não saudável, reiniciar
    if [ "$green_running" = true ] && [ "$blue_healthy" = false ]; then
        log "Reiniciando Green (não saudável)..."
        docker compose -f docker-compose.green.yml restart || true
        sleep 10
        if "$HEALTH_CHECK" green 30 >/dev/null 2>&1; then
            log_success "Green reiniciado e saudável"
            green_healthy=true
        fi
    fi
    
    # Se nenhum está saudável, iniciar Blue
    if [ "$blue_healthy" = false ] && [ "$green_healthy" = false ]; then
        log_error "Nenhum container ficou saudável após reinício. Iniciando Blue..."
        
        # Parar tudo primeiro
        docker compose -f docker-compose.blue.yml down 2>/dev/null || true
        docker compose -f docker-compose.green.yml down 2>/dev/null || true
        
        # Iniciar Blue
        docker compose -f docker-compose.blue.yml up -d
        
        # Aguardar e verificar
        sleep 15
        if "$HEALTH_CHECK" blue 60 >/dev/null 2>&1; then
            log_success "Blue iniciado e saudável"
            blue_healthy=true
            
            # Atualizar Nginx
            if [ -f "/etc/nginx/sites-available/kanban-buzz" ]; then
                sudo sed -i "s/default [a-z]*;/default blue;/" /etc/nginx/sites-available/kanban-buzz 2>/dev/null || true
                sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx >/dev/null 2>&1 || true
            fi
        else
            log_error "FALHA CRÍTICA: Blue não ficou saudável após iniciar"
            exit 1
        fi
    fi
fi

# REGRA 2: Verificar se Nginx aponta para container que está rodando
if [ -f "/etc/nginx/sites-available/kanban-buzz" ]; then
    nginx_target=$(grep -o "default [a-z]*;" /etc/nginx/sites-available/kanban-buzz | grep -o "[a-z]*" | tail -1)
    
    if [ "$nginx_target" = "blue" ] && [ "$blue_healthy" = false ]; then
        log_warn "Nginx aponta para Blue mas Blue não está saudável"
        if [ "$green_healthy" = true ]; then
            log "Alternando Nginx para Green..."
            sudo sed -i "s/default [a-z]*;/default green;/" /etc/nginx/sites-available/kanban-buzz
            sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx >/dev/null 2>&1 || true
            log_success "Nginx alternado para Green"
        fi
    elif [ "$nginx_target" = "green" ] && [ "$green_healthy" = false ]; then
        log_warn "Nginx aponta para Green mas Green não está saudável"
        if [ "$blue_healthy" = true ]; then
            log "Alternando Nginx para Blue..."
            sudo sed -i "s/default [a-z]*;/default blue;/" /etc/nginx/sites-available/kanban-buzz
            sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx >/dev/null 2>&1 || true
            log_success "Nginx alternado para Blue"
        fi
    fi
fi

# REGRA 3: Garantir restart policy está correta
log "Verificando restart policy dos containers..."
blue_restart=$(docker inspect kanban-buzz-app-blue --format='{{.HostConfig.RestartPolicy.Name}}' 2>/dev/null || echo "none")
if [ "$blue_restart" != "always" ]; then
    log_warn "Restart policy do Blue não é 'always' (atual: $blue_restart)"
    # Não podemos mudar restart policy de container rodando, mas podemos garantir no compose
fi

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
    green_restart=$(docker inspect kanban-buzz-app-green --format='{{.HostConfig.RestartPolicy.Name}}' 2>/dev/null || echo "none")
    if [ "$green_restart" != "always" ]; then
        log_warn "Restart policy do Green não é 'always' (atual: $green_restart)"
    fi
fi

log_success "Verificação concluída - Sistema está protegido"

exit 0


#!/bin/bash

# 🔍 Script: Detectar Deploys Incorretos
# Descrição: Monitora e detecta quando método antigo de deploy é usado
# Uso: Executar em background ou como serviço

set -e

LOG_FILE="/var/log/kanban-buzz-deploy-protection.log"
ALERT_FILE="/var/log/kanban-buzz-deploy-alerts.log"
CHECK_INTERVAL=10  # Verificar a cada 10 segundos

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

detect_incorrect_deploy() {
    # Verificar se há container antigo rodando (sem blue/green)
    if docker ps --format '{{.Names}}' | grep -qE "^kanban-buzz-app$"; then
        log "🚨 ALERTA: Container antigo detectado (kanban-buzz-app sem porta mapeada)"
        log "   Isso indica que método antigo de deploy foi usado!"
        log "   Container deve ser: kanban-buzz-app-blue ou kanban-buzz-app-green"
        
        # Verificar se porta 3000 está mapeada
        if ! docker ps --format '{{.Names}}\t{{.Ports}}' | grep "kanban-buzz-app" | grep -q "3000"; then
            log "🚨 CRÍTICO: Container rodando sem porta 3000 mapeada!"
            log "   Sistema pode estar sem resposta!"
            
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 CRÍTICO: Container sem porta - sistema pode estar sem resposta" >> "$ALERT_FILE"
        fi
        
        return 1
    fi
    
    # Verificar se há container blue/green rodando
    local has_blue_or_green=false
    if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-blue"; then
        has_blue_or_green=true
    fi
    if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
        has_blue_or_green=true
    fi
    
    if [ "$has_blue_or_green" = false ]; then
        log "🚨 ALERTA: Nenhum container blue/green está rodando!"
        log "   Sistema pode estar usando método antigo ou caiu!"
        
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 ALERTA: Nenhum container blue/green rodando" >> "$ALERT_FILE"
        return 1
    fi
    
    return 0
}

check_recent_commands() {
    # Verificar histórico recente por comandos perigosos
    local recent_commands=$(history | tail -20 | grep -E "(docker compose down|docker-compose down)" | grep -v "blue\|green" | tail -5)
    
    if [ -n "$recent_commands" ]; then
        log "🚨 ALERTA: Comandos perigosos detectados no histórico:"
        echo "$recent_commands" | while read cmd; do
            log "   $cmd"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 Comando perigoso no histórico: $cmd" >> "$ALERT_FILE"
        done
    fi
}

main() {
    log "🔍 Detector de deploys incorretos iniciado"
    
    while true; do
        if ! detect_incorrect_deploy; then
            log "⚠️ Problema detectado - verificar logs em $ALERT_FILE"
        fi
        
        check_recent_commands
        
        sleep $CHECK_INTERVAL
    done
}

main



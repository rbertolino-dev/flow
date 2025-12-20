#!/bin/bash

# 🛡️ Script: Proteção de Deploy - Detecta e Bloqueia Método Antigo
# Descrição: Intercepta comandos Docker perigosos e registra em log
# Uso: Source este script ou adicione ao .bashrc

LOG_FILE="/var/log/kanban-buzz-deploy-protection.log"
ALERT_FILE="/var/log/kanban-buzz-deploy-alerts.log"

log_alert() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local user=$(whoami)
    local pid=$$
    local command_line=$(history 1 | sed 's/^[ ]*[0-9]*[ ]*//')
    
    echo "[$timestamp] 🚨 ALERTA: $message" | tee -a "$LOG_FILE"
    echo "[$timestamp] Usuário: $user | PID: $pid | Comando: $command_line" | tee -a "$LOG_FILE"
    echo "[$timestamp] Stack trace:" | tee -a "$LOG_FILE"
    echo "$(caller)" | tee -a "$LOG_FILE"
    echo "---" | tee -a "$LOG_FILE"
    
    # Log de alerta separado
    echo "[$timestamp] 🚨 $user tentou usar método antigo de deploy: $command_line" >> "$ALERT_FILE"
}

# Função wrapper para docker compose down
docker_compose_down_wrapper() {
    local args="$@"
    
    # Verificar se está tentando fazer down do sistema principal
    if echo "$args" | grep -qE "(docker-compose\.yml|docker compose down[[:space:]]*$)"; then
        log_alert "Tentativa de usar 'docker compose down' (método antigo - causa downtime!)"
        
        echo "⚠️  ATENÇÃO: Você está tentando usar o método antigo de deploy que causa downtime!" >&2
        echo "   Use: ./scripts/deploy-zero-downtime-ultra-robusto.sh" >&2
        echo "   Log registrado em: $LOG_FILE" >&2
        
        # NÃO executar - retornar erro
        return 1
    fi
    
    # Permitir down de blue/green (parte do zero-downtime)
    command docker compose down "$@"
}

# Função wrapper para docker compose up
docker_compose_up_wrapper() {
    local args="$@"
    
    # Verificar se está tentando fazer up sem usar zero-downtime
    if echo "$args" | grep -qE "docker-compose\.yml" && ! echo "$args" | grep -qE "(blue|green)"; then
        log_alert "Tentativa de usar 'docker compose up' sem zero-downtime (método antigo - causa downtime!)"
        
        echo "⚠️  ATENÇÃO: Você está tentando usar o método antigo de deploy que causa downtime!" >&2
        echo "   Use: ./scripts/deploy-zero-downtime-ultra-robusto.sh" >&2
        echo "   Log registrado em: $LOG_FILE" >&2
        
        # NÃO executar - retornar erro
        return 1
    fi
    
    # Permitir up de blue/green (parte do zero-downtime)
    command docker compose up "$@"
}

# Criar aliases se não existirem
if ! alias | grep -q "docker compose down"; then
    alias 'docker compose down'='docker_compose_down_wrapper'
    alias 'docker-compose down'='docker_compose_down_wrapper'
fi

if ! alias | grep -q "docker compose up"; then
    alias 'docker compose up'='docker_compose_up_wrapper'
    alias 'docker-compose up'='docker_compose_up_wrapper'
fi

echo "🛡️ Proteção de deploy ativada. Logs em: $LOG_FILE"



#!/bin/bash

# 🪝 Hook: Intercepta docker compose commands
# Descrição: Detecta e bloqueia uso do método antigo de deploy
# Uso: Source este arquivo no .bashrc ou adicione ao PATH

LOG_FILE="/var/log/kanban-buzz-deploy-protection.log"
ALERT_FILE="/var/log/kanban-buzz-deploy-alerts.log"

log_deploy_attempt() {
    local command="$1"
    local user=$(whoami)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local pid=$$
    local pwd=$(pwd)
    
    # Detalhes do processo
    local parent_pid=$(ps -o ppid= -p $$ | tr -d ' ')
    local parent_cmd=$(ps -p $parent_pid -o cmd= 2>/dev/null || echo "unknown")
    
    echo "[$timestamp] 🚨 TENTATIVA DE DEPLOY INCORRETO" >> "$LOG_FILE"
    echo "[$timestamp] Comando: $command" >> "$LOG_FILE"
    echo "[$timestamp] Usuário: $user" >> "$LOG_FILE"
    echo "[$timestamp] PID: $$" >> "$LOG_FILE"
    echo "[$timestamp] Diretório: $pwd" >> "$LOG_FILE"
    echo "[$timestamp] Processo pai: $parent_cmd" >> "$LOG_FILE"
    echo "[$timestamp] Stack: $(caller)" >> "$LOG_FILE"
    echo "---" >> "$LOG_FILE"
    
    # Alerta crítico
    echo "[$timestamp] 🚨 $user tentou: $command (método antigo - causa downtime!)" >> "$ALERT_FILE"
}

# Wrapper para docker compose
docker_compose() {
    local cmd="$1"
    shift
    local args="$@"
    
    # Detectar comandos perigosos
    if [ "$cmd" = "down" ] || [ "$cmd" = "up" ]; then
        # Verificar se está usando docker-compose.yml (método antigo)
        if echo "$args" | grep -qE "docker-compose\.yml" || [ -z "$args" ]; then
            # Verificar se NÃO está usando blue/green
            if ! echo "$args" | grep -qE "(blue|green)"; then
                log_deploy_attempt "docker compose $cmd $args"
                
                echo "🚨 ERRO: Você está tentando usar o método antigo de deploy!" >&2
                echo "" >&2
                echo "   ❌ Comando perigoso: docker compose $cmd $args" >&2
                echo "   ✅ Use: ./scripts/deploy-zero-downtime-ultra-robusto.sh" >&2
                echo "" >&2
                echo "   📋 Log registrado em: $LOG_FILE" >&2
                echo "   🚨 Alerta registrado em: $ALERT_FILE" >&2
                echo "" >&2
                
                # NÃO executar - retornar erro
                return 1
            fi
        fi
    fi
    
    # Executar comando normalmente se passou nas verificações
    command docker compose "$cmd" "$@"
}

# Exportar função
export -f docker_compose
export -f log_deploy_attempt

echo "🪝 Hook de proteção de deploy ativado"



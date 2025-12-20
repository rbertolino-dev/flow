#!/bin/bash

# 🛡️ Monitor Contínuo do Sistema - Previne Quedas
# Descrição: Monitora sistema continuamente e restaura automaticamente se cair
# Uso: Executar em background ou como serviço systemd

# Não usar set -e para permitir tratamento de erros manual

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_CHECK="$SCRIPT_DIR/health-check.sh"
GARANTIR_ATIVO="$SCRIPT_DIR/garantir-sistema-ativo.sh"

LOG_FILE="/var/log/kanban-buzz-monitor.log"
CHECK_INTERVAL=30  # Verificar a cada 30 segundos
MAX_FAILURES=3     # Máximo de falhas antes de restaurar

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_system() {
    local failures=0
    
    # Verificar porta 3000 (Blue) - com múltiplas tentativas para evitar falsos positivos
    local blue_healthy=false
    for i in {1..3}; do
        if curl -s -f -m 3 http://localhost:3000/health >/dev/null 2>&1; then
            blue_healthy=true
            break
        fi
        sleep 1
    done
    
    if [ "$blue_healthy" = false ]; then
        failures=$((failures + 1))
        log "❌ Porta 3000 não responde após 3 tentativas"
    fi
    
    # Verificar porta 3001 (Green, se estiver rodando)
    if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
        if ! curl -s -f -m 5 http://localhost:3001/health >/dev/null 2>&1; then
            failures=$((failures + 1))
            log "❌ Porta 3001 não responde"
        fi
    fi
    
    # Verificar Nginx - com múltiplas tentativas
    local nginx_healthy=false
    for i in {1..3}; do
        if curl -s -f -m 3 http://localhost/health >/dev/null 2>&1; then
            nginx_healthy=true
            break
        fi
        sleep 1
    done
    
    if [ "$nginx_healthy" = false ]; then
        failures=$((failures + 1))
        log "❌ Nginx não responde após 3 tentativas"
    fi
    
    # Verificar se há container antigo rodando (sem porta)
    if docker ps --format '{{.Names}}' | grep -qE "^kanban-buzz-app$"; then
        failures=$((failures + 1))
        log "❌ Container antigo detectado (sem porta mapeada)"
    fi
    
    # Verificar se pelo menos um container blue/green está rodando
    local has_blue_or_green=false
    if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-blue"; then
        has_blue_or_green=true
    fi
    if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
        has_blue_or_green=true
    fi
    
    if [ "$has_blue_or_green" = false ]; then
        failures=$((failures + 1))
        log "❌ Nenhum container blue/green está rodando"
    fi
    
    return $failures
}

restore_system() {
    log "🔄 Iniciando restauração automática do sistema..."
    
    cd "$PROJECT_DIR"
    
    # Verificar se Blue ou Green está rodando antes de parar
    local blue_running=false
    local green_running=false
    
    if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-blue"; then
        blue_running=true
        log "Blue está rodando, verificando saúde antes de parar..."
        if "$HEALTH_CHECK" blue 5 >/dev/null 2>&1; then
            log "⚠️ Blue está saudável! Investigando por que monitor detectou falha..."
            # Não parar se está saudável - pode ser problema temporário de rede
            return 0
        fi
    fi
    
    if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
        green_running=true
        log "Green está rodando, verificando saúde antes de parar..."
        if "$HEALTH_CHECK" green 5 >/dev/null 2>&1; then
            log "⚠️ Green está saudável! Investigando por que monitor detectou falha..."
            # Não parar se está saudável - pode ser problema temporário de rede
            return 0
        fi
    fi
    
    # Se chegou aqui, realmente precisa restaurar
    log "Nenhum container saudável encontrado. Iniciando restauração..."
    
    # Parar apenas containers problemáticos (não saudáveis)
    if [ "$blue_running" = true ]; then
        log "Parando Blue (não saudável)..."
        docker compose -f docker-compose.blue.yml down 2>/dev/null || true
    fi
    
    if [ "$green_running" = true ]; then
        log "Parando Green (não saudável)..."
        docker compose -f docker-compose.green.yml down 2>/dev/null || true
    fi
    
    # Parar container antigo (sem porta)
    docker compose down 2>/dev/null || true
    
    # Remover containers antigos
    docker ps -a --format '{{.Names}}' | grep -E "^kanban-buzz-app$" | while read container; do
        docker stop "$container" 2>/dev/null || true
        docker rm "$container" 2>/dev/null || true
    done
    
    # Iniciar Blue
    log "Iniciando Blue..."
    docker compose -f docker-compose.blue.yml up -d
    
    # Aguardar e verificar com múltiplas tentativas
    local max_attempts=6
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        sleep 10
        attempt=$((attempt + 1))
        log "Verificando saúde do Blue (tentativa $attempt/$max_attempts)..."
        
        if "$HEALTH_CHECK" blue 10 >/dev/null 2>&1; then
            log "✅ Blue restaurado e saudável (tentativa $attempt)"
            
            # Atualizar Nginx
            if [ -f "/etc/nginx/sites-available/kanban-buzz" ]; then
                sudo sed -i "s/default [a-z]*;/default blue;/" /etc/nginx/sites-available/kanban-buzz 2>/dev/null || true
                sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx >/dev/null 2>&1 || true
            fi
            
            return 0
        fi
    done
    
    log "❌ Falha ao restaurar Blue após $max_attempts tentativas"
    return 1
}

# Loop principal de monitoramento
main() {
    log "🛡️ Monitor de sistema iniciado (verifica a cada ${CHECK_INTERVAL}s)"
    
    local consecutive_failures=0
    
    while true; do
        if check_system; then
            if [ $consecutive_failures -gt 0 ]; then
                log "✅ Sistema recuperado após $consecutive_failures falhas"
                consecutive_failures=0
            fi
        else
            consecutive_failures=$((consecutive_failures + 1))
            log "⚠️ Falha detectada ($consecutive_failures/$MAX_FAILURES)"
            
            if [ $consecutive_failures -ge $MAX_FAILURES ]; then
                log "🚨 Múltiplas falhas detectadas! Restaurando sistema..."
                restore_system
                consecutive_failures=0
                sleep 30  # Aguardar após restauração
            fi
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Executar
main






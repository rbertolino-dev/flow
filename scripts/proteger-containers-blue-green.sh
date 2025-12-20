#!/bin/bash

# 🛡️ Script: Proteção de Containers Blue-Green
# Descrição: Garante que sempre há um container rodando e Nginx está configurado corretamente
# Uso: ./scripts/proteger-containers-blue-green.sh
# Execução: Deve ser executado periodicamente (cron) ou após qualquer operação Docker
# 
# NOTA: Script verifica lock de deploy antes de executar - aguarda indefinidamente se deploy em andamento

# NÃO usar set -e - tratar erros individualmente para não sair prematuramente

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HEALTH_CHECK="$SCRIPT_DIR/health-check.sh"
GET_LAST_DEPLOY="$SCRIPT_DIR/get-last-deploy.sh"
NGINX_HELPER="$SCRIPT_DIR/nginx-helper.sh"
NGINX_HELPER="$SCRIPT_DIR/nginx-helper.sh"

log() {
    echo -e "${BLUE}[PROTECAO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[PROTECAO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[PROTECAO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[PROTECAO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

cd "$PROJECT_DIR"

# Verificar se há deploy em andamento (verificar lock)
DEPLOY_LOCK_FILE="/tmp/deploy-zero-downtime.lock"
if [ -f "$DEPLOY_LOCK_FILE" ]; then
    if command -v flock &> /dev/null; then
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
                else
                    log "Deploy em andamento detectado. Aguardando na fila (timeout: 5 minutos)..."
                    # Aguardar com timeout de 5 minutos (ao invés de indefinidamente)
                    timeout 300 flock 202 2>/dev/null || {
                        log_warn "Timeout aguardando deploy. Continuando proteção sem lock..."
                    }
                fi
            fi
        else
            exec 202>"$DEPLOY_LOCK_FILE"
            if ! flock -n 202 2>/dev/null; then
                log "Deploy em andamento detectado. Aguardando na fila (timeout: 5 minutos)..."
                # Aguardar com timeout de 5 minutos
                timeout 300 flock 202 2>/dev/null || {
                    log_warn "Timeout aguardando deploy. Continuando proteção sem lock..."
                }
            fi
            exec 202>&-
        fi
    else
        log_warn "flock não disponível. Continuando sem verificar lock de deploy (pode haver conflitos)."
    fi
fi

# Verificar quais containers estão rodando
BLUE_RUNNING=false
GREEN_RUNNING=false
BLUE_HEALTHY=false
GREEN_HEALTHY=false

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-blue"; then
    BLUE_RUNNING=true
    if "$HEALTH_CHECK" blue 5 >/dev/null 2>&1; then
        BLUE_HEALTHY=true
    fi
fi

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app-green"; then
    GREEN_RUNNING=true
    if "$HEALTH_CHECK" green 5 >/dev/null 2>&1; then
        GREEN_HEALTHY=true
    fi
fi

# Verificar configuração do Nginx
NGINX_CONFIG="/etc/nginx/sites-available/kanban-buzz"
NGINX_AGILIZE="/etc/nginx/sites-enabled/agilizeflow.com.br"

if [ -f "$NGINX_CONFIG" ]; then
    NGINX_TARGET=$(grep -o "default [a-z]*;" "$NGINX_CONFIG" 2>/dev/null | grep -o "[a-z]*" | tail -1 || echo "blue")
else
    NGINX_TARGET="blue"
fi

# Verificar configuração do agilizeflow.com.br
if [ -f "$NGINX_AGILIZE" ]; then
    AGILIZE_PORT=$(grep "proxy_pass" "$NGINX_AGILIZE" | grep -o "localhost:[0-9]*" | head -1 | grep -o "[0-9]*" || echo "3000")
    if [ "$AGILIZE_PORT" = "3001" ]; then
        AGILIZE_TARGET="green"
    else
        AGILIZE_TARGET="blue"
    fi
else
    AGILIZE_TARGET="blue"
    AGILIZE_PORT="3000"
fi

# Identificar qual deveria ser o último deploy
LAST_DEPLOY_SHOULD_BE=""
if [ -f "$GET_LAST_DEPLOY" ]; then
    chmod +x "$GET_LAST_DEPLOY" 2>/dev/null || true
    LAST_DEPLOY_SHOULD_BE=$("$GET_LAST_DEPLOY" 2>/dev/null || echo "")
fi

log "Verificando estado do sistema..."
log "  Blue: $([ "$BLUE_RUNNING" = true ] && echo "rodando" || echo "parado") $([ "$BLUE_HEALTHY" = true ] && echo "(saudável)" || echo "(não saudável)")"
log "  Green: $([ "$GREEN_RUNNING" = true ] && echo "rodando" || echo "parado") $([ "$GREEN_HEALTHY" = true ] && echo "(saudável)" || echo "(não saudável)")"
log "  Nginx kanban-buzz: $NGINX_TARGET"
log "  Nginx agilizeflow.com.br: $AGILIZE_TARGET (porta $AGILIZE_PORT)"
if [ -n "$LAST_DEPLOY_SHOULD_BE" ]; then
    log "  Último deploy deveria ser: $LAST_DEPLOY_SHOULD_BE"
fi

# REGRA 1: Sempre deve haver pelo menos um container rodando e saudável
if [ "$BLUE_RUNNING" = false ] && [ "$GREEN_RUNNING" = false ]; then
    log_error "CRÍTICO: Nenhum container está rodando!"
    
    # Tentar restaurar último deploy se identificado
    if [ -n "$LAST_DEPLOY_SHOULD_BE" ] && [ "$LAST_DEPLOY_SHOULD_BE" != "" ]; then
        log "Restaurando último deploy identificado: ${LAST_DEPLOY_SHOULD_BE}..."
        docker compose -f docker-compose.${LAST_DEPLOY_SHOULD_BE}.yml up -d || {
            log_error "Falha ao restaurar ${LAST_DEPLOY_SHOULD_BE}"
            # Fallback para Blue
            LAST_DEPLOY_SHOULD_BE="blue"
        }
    else
        # Fallback: restaurar Blue
        log "Restaurando Blue (fallback)..."
        LAST_DEPLOY_SHOULD_BE="blue"
    fi
    
    docker compose -f docker-compose.${LAST_DEPLOY_SHOULD_BE}.yml up -d || {
        log_error "Falha ao restaurar ${LAST_DEPLOY_SHOULD_BE}"
        exit 1
    }
    
    sleep 10
    
    if "$HEALTH_CHECK" "${LAST_DEPLOY_SHOULD_BE}" 30; then
        log_success "${LAST_DEPLOY_SHOULD_BE} restaurado e saudável"
        if [ "$LAST_DEPLOY_SHOULD_BE" = "blue" ]; then
            BLUE_RUNNING=true
            BLUE_HEALTHY=true
        else
            GREEN_RUNNING=true
            GREEN_HEALTHY=true
        fi
    else
        log_error "${LAST_DEPLOY_SHOULD_BE} não ficou saudável após restauração"
        exit 1
    fi
fi

# REGRA 2: Se Nginx aponta para uma versão que não está rodando, corrigir para último deploy
if [ "$NGINX_TARGET" = "green" ] && [ "$GREEN_RUNNING" = false ]; then
    log_warn "Nginx aponta para Green mas Green não está rodando."
    
    # Tentar corrigir para último deploy identificado
    if [ -n "$LAST_DEPLOY_SHOULD_BE" ] && [ "$LAST_DEPLOY_SHOULD_BE" != "" ]; then
        if [ "$LAST_DEPLOY_SHOULD_BE" = "blue" ] && [ "$BLUE_RUNNING" = true ] && [ "$BLUE_HEALTHY" = true ]; then
            log "Corrigindo Nginx para último deploy: Blue..."
            sudo sed -i 's|default green;|default blue;|' "$NGINX_CONFIG" 2>/dev/null || true
            sudo nginx -t && sudo systemctl reload nginx
            log_success "Nginx kanban-buzz corrigido para Blue (último deploy)"
        elif [ "$LAST_DEPLOY_SHOULD_BE" = "green" ]; then
            log_error "Último deploy deveria ser Green mas não está rodando. Restaurando..."
            docker compose -f docker-compose.green.yml up -d
            sleep 10
            if "$HEALTH_CHECK" green 30; then
                log_success "Green restaurado"
            fi
        fi
    elif [ "$BLUE_RUNNING" = true ] && [ "$BLUE_HEALTHY" = true ]; then
        log "Corrigindo Nginx para Blue..."
        sudo sed -i 's|default green;|default blue;|' "$NGINX_CONFIG" 2>/dev/null || true
        sudo nginx -t && sudo systemctl reload nginx
        log_success "Nginx kanban-buzz corrigido para Blue"
    else
        log_error "Nenhuma versão está rodando/saudável. Não é seguro corrigir Nginx."
    fi
fi

if [ "$NGINX_TARGET" = "blue" ] && [ "$BLUE_RUNNING" = false ]; then
    log_warn "Nginx aponta para Blue mas Blue não está rodando."
    
    # Tentar corrigir para último deploy identificado usando nginx-helper
    source "$SCRIPT_DIR/nginx-helper.sh" 2>/dev/null || true
    
    if [ -n "$LAST_DEPLOY_SHOULD_BE" ] && [ "$LAST_DEPLOY_SHOULD_BE" != "" ]; then
        if [ "$LAST_DEPLOY_SHOULD_BE" = "green" ] && [ "$GREEN_RUNNING" = true ] && [ "$GREEN_HEALTHY" = true ]; then
            log "Corrigindo Nginx para último deploy: Green..."
            if command -v update_nginx &> /dev/null; then
                update_nginx "green" "3001" || log_warn "Falha ao atualizar Nginx usando helper"
            else
                sudo sed -i 's|default blue;|default green;|' "$NGINX_CONFIG" 2>/dev/null || true
                sudo nginx -t && sudo systemctl reload nginx
            fi
            log_success "Nginx kanban-buzz corrigido para Green (último deploy)"
        elif [ "$LAST_DEPLOY_SHOULD_BE" = "blue" ]; then
            log_error "Último deploy deveria ser Blue mas não está rodando. Restaurando..."
            docker compose -f docker-compose.blue.yml up -d || log_error "Falha ao restaurar Blue"
            sleep 10
            if "$HEALTH_CHECK" blue 30; then
                log_success "Blue restaurado"
            fi
        fi
    elif [ "$GREEN_RUNNING" = true ] && [ "$GREEN_HEALTHY" = true ]; then
        log "Corrigindo Nginx para Green..."
        if command -v update_nginx &> /dev/null; then
            update_nginx "green" "3001" || log_warn "Falha ao atualizar Nginx usando helper"
        else
            sudo sed -i 's|default blue;|default green;|' "$NGINX_CONFIG" 2>/dev/null || true
            sudo nginx -t && sudo systemctl reload nginx
        fi
        log_success "Nginx kanban-buzz corrigido para Green"
    else
        log_error "Nenhuma versão está rodando/saudável. Não é seguro corrigir Nginx."
    fi
fi

# REGRA 2.5: Se último deploy identificado não está rodando, restaurar
if [ -n "$LAST_DEPLOY_SHOULD_BE" ] && [ "$LAST_DEPLOY_SHOULD_BE" != "" ]; then
    if [ "$LAST_DEPLOY_SHOULD_BE" = "blue" ] && [ "$BLUE_RUNNING" = false ]; then
        log_error "Último deploy (Blue) não está rodando! Restaurando..."
        docker compose -f docker-compose.blue.yml up -d || {
            log_error "Falha ao restaurar Blue"
            exit 1
        }
        sleep 10
        if "$HEALTH_CHECK" blue 30; then
            log_success "Blue (último deploy) restaurado e saudável"
            BLUE_RUNNING=true
            BLUE_HEALTHY=true
        else
            log_error "Blue não ficou saudável após restauração"
            exit 1
        fi
    elif [ "$LAST_DEPLOY_SHOULD_BE" = "green" ] && [ "$GREEN_RUNNING" = false ]; then
        log_error "Último deploy (Green) não está rodando! Restaurando..."
        docker compose -f docker-compose.green.yml up -d || {
            log_error "Falha ao restaurar Green"
            exit 1
        }
        sleep 10
        if "$HEALTH_CHECK" green 30; then
            log_success "Green (último deploy) restaurado e saudável"
            GREEN_RUNNING=true
            GREEN_HEALTHY=true
        else
            log_error "Green não ficou saudável após restauração"
            exit 1
        fi
    fi
fi

# REGRA 3: Corrigir agilizeflow.com.br para apontar para último deploy (usando nginx-helper)
# nginx-helper já atualiza ambos arquivos sincronizados, então esta regra é redundante
# mas mantemos para garantir que agilize está correto se kanban-buzz já foi corrigido
if [ "$AGILIZE_TARGET" = "green" ] && [ "$GREEN_RUNNING" = false ]; then
    log_warn "agilizeflow.com.br aponta para Green (porta 3001) mas Green não está rodando."
    
    # nginx-helper já deve ter corrigido, mas verificamos
    if [ -n "$LAST_DEPLOY_SHOULD_BE" ] && [ "$LAST_DEPLOY_SHOULD_BE" = "blue" ] && [ "$BLUE_RUNNING" = true ] && [ "$BLUE_HEALTHY" = true ]; then
        log "Verificando/corrigindo agilizeflow.com.br para último deploy: Blue..."
        if command -v update_nginx &> /dev/null; then
            update_nginx "blue" "3000" || log_warn "Falha ao atualizar Nginx usando helper"
        else
            sudo sed -i 's|localhost:3001|localhost:3000|g' "$NGINX_AGILIZE" 2>/dev/null || true
            sudo nginx -t && sudo systemctl reload nginx
        fi
        log_success "agilizeflow.com.br corrigido para Blue (porta 3000) - último deploy"
    elif [ "$BLUE_RUNNING" = true ] && [ "$BLUE_HEALTHY" = true ]; then
        log "Corrigindo agilizeflow.com.br para Blue..."
        if command -v update_nginx &> /dev/null; then
            update_nginx "blue" "3000" || log_warn "Falha ao atualizar Nginx usando helper"
        else
            sudo sed -i 's|localhost:3001|localhost:3000|g' "$NGINX_AGILIZE" 2>/dev/null || true
            sudo nginx -t && sudo systemctl reload nginx
        fi
        log_success "agilizeflow.com.br corrigido para Blue (porta 3000)"
    fi
fi

if [ "$AGILIZE_TARGET" = "blue" ] && [ "$BLUE_RUNNING" = false ]; then
    log_warn "agilizeflow.com.br aponta para Blue (porta 3000) mas Blue não está rodando."
    
    # nginx-helper já deve ter corrigido, mas verificamos
    if [ -n "$LAST_DEPLOY_SHOULD_BE" ] && [ "$LAST_DEPLOY_SHOULD_BE" = "green" ] && [ "$GREEN_RUNNING" = true ] && [ "$GREEN_HEALTHY" = true ]; then
        log "Verificando/corrigindo agilizeflow.com.br para último deploy: Green..."
        if command -v update_nginx &> /dev/null; then
            update_nginx "green" "3001" || log_warn "Falha ao atualizar Nginx usando helper"
        else
            sudo sed -i 's|localhost:3000|localhost:3001|g' "$NGINX_AGILIZE" 2>/dev/null || true
            sudo nginx -t && sudo systemctl reload nginx
        fi
        log_success "agilizeflow.com.br corrigido para Green (porta 3001) - último deploy"
    elif [ "$GREEN_RUNNING" = true ] && [ "$GREEN_HEALTHY" = true ]; then
        log "Corrigindo agilizeflow.com.br para Green..."
        if command -v update_nginx &> /dev/null; then
            update_nginx "green" "3001" || log_warn "Falha ao atualizar Nginx usando helper"
        else
            sudo sed -i 's|localhost:3000|localhost:3001|g' "$NGINX_AGILIZE" 2>/dev/null || true
            sudo nginx -t && sudo systemctl reload nginx
        fi
        log_success "agilizeflow.com.br corrigido para Green (porta 3001)"
    fi
fi

# REGRA 4: Se ambas versões estão rodando mas Nginx aponta para a errada, manter como está (não corrigir automaticamente)
# Isso evita interferir em deploys em andamento

# REGRA 5: Se container está rodando mas não saudável, tentar reiniciar
if [ "$BLUE_RUNNING" = true ] && [ "$BLUE_HEALTHY" = false ]; then
    log_warn "Blue está rodando mas não saudável. Reiniciando..."
    docker compose -f docker-compose.blue.yml restart
    sleep 10
    if "$HEALTH_CHECK" blue 30; then
        log_success "Blue reiniciado e saudável"
    else
        log_error "Blue não ficou saudável após reinício"
    fi
fi

if [ "$GREEN_RUNNING" = true ] && [ "$GREEN_HEALTHY" = false ]; then
    log_warn "Green está rodando mas não saudável. Reiniciando..."
    docker compose -f docker-compose.green.yml restart
    sleep 10
    if "$HEALTH_CHECK" green 30; then
        log_success "Green reiniciado e saudável"
    else
        log_error "Green não ficou saudável após reinício"
    fi
fi

log_success "Verificação de proteção concluída"


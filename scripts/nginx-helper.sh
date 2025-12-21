#!/bin/bash

# 🔧 Script Helper: Atualização Protegida do Nginx
# Descrição: Função protegida para atualizar ambos arquivos Nginx de forma sincronizada
# Uso: source scripts/nginx-helper.sh && update_nginx blue 3000

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Arquivos de configuração
NGINX_KANBAN_BUZZ="/etc/nginx/sites-available/kanban-buzz"
NGINX_AGILIZE="/etc/nginx/sites-enabled/agilizeflow.com.br"
NGINX_LOCK="/tmp/nginx-update.lock"

log() {
    echo -e "${BLUE}[NGINX-HELPER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[NGINX-HELPER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[NGINX-HELPER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[NGINX-HELPER]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Função para atualizar Nginx de forma protegida
update_nginx() {
    local target_version=$1
    local target_port=$2
    
    if [ -z "$target_version" ] || [ -z "$target_port" ]; then
        log_error "Uso: update_nginx [blue|green] [3000|3001]"
        return 1
    fi
    
    # Verificar se flock está disponível
    if ! command -v flock &> /dev/null; then
        log_error "flock não está disponível. Atualizando Nginx sem lock (não recomendado)."
    fi
    
    # Adquirir lock para atualização do Nginx
    exec 201>"$NGINX_LOCK"
    
    if ! flock -n 201 2>/dev/null; then
        log_warn "Outra atualização de Nginx em andamento. Aguardando na fila (sem timeout)..."
        flock 201
        log_success "Lock adquirido! Atualizando Nginx..."
    fi
    
    log "Atualizando Nginx para ${target_version} (porta ${target_port})..."
    
    # Atualizar kanban-buzz
    if [ -f "$NGINX_KANBAN_BUZZ" ]; then
        sudo sed -i "s/default [a-z]*;/default ${target_version};/" "$NGINX_KANBAN_BUZZ" 2>/dev/null || {
            log_error "Falha ao atualizar $NGINX_KANBAN_BUZZ"
            flock -u 201
            exec 201>&-
            return 1
        }
        log_success "kanban-buzz atualizado para ${target_version}"
    else
        log_warn "Arquivo $NGINX_KANBAN_BUZZ não encontrado"
    fi
    
    # Atualizar agilizeflow.com.br
    if [ -f "$NGINX_AGILIZE" ]; then
        sudo sed -i "s|proxy_pass http://localhost:[0-9]*;|proxy_pass http://localhost:${target_port};|g" "$NGINX_AGILIZE" 2>/dev/null || {
            log_error "Falha ao atualizar $NGINX_AGILIZE"
            flock -u 201
            exec 201>&-
            return 1
        }
        log_success "agilizeflow.com.br atualizado para porta ${target_port}"
    else
        log_warn "Arquivo $NGINX_AGILIZE não encontrado"
    fi
    
    # Verificar sincronização
    local kanban_target=$(grep -o "default [a-z]*;" "$NGINX_KANBAN_BUZZ" 2>/dev/null | grep -o "[a-z]*" | tail -1 || echo "")
    local agilize_port=$(grep "proxy_pass" "$NGINX_AGILIZE" 2>/dev/null | grep -o "localhost:[0-9]*" | head -1 | grep -o "[0-9]*" || echo "")
    local expected_port=$([ "$target_version" = "blue" ] && echo "3000" || echo "3001")
    
    if [ "$kanban_target" != "$target_version" ] || [ "$agilize_port" != "$target_port" ] || [ "$agilize_port" != "$expected_port" ]; then
        log_error "Falha na sincronização! kanban-buzz: ${kanban_target}, agilize: porta ${agilize_port}, esperado: ${target_version} porta ${target_port}"
        flock -u 201
        exec 201>&-
        return 1
    fi
    
    # Testar configuração ANTES de recarregar
    if ! sudo nginx -t 2>/dev/null; then
        log_error "Configuração do Nginx inválida após atualização!"
        flock -u 201
        exec 201>&-
        return 1
    fi
    
    # Recarregar Nginx
    if sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null; then
        log_success "Nginx recarregado com sucesso - ambos arquivos sincronizados para ${target_version} (porta ${target_port})"
    else
        log_error "Falha ao recarregar Nginx"
        flock -u 201
        exec 201>&-
        return 1
    fi
    
    # Liberar lock
    flock -u 201
    exec 201>&-
    
    return 0
}

# Exportar função se script for source'd
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    export -f update_nginx
fi






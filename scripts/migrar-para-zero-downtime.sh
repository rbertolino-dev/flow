#!/bin/bash

# 🔄 Script: Migração para Zero-Downtime Deployment
# Descrição: Migra do deploy antigo para o novo sistema blue-green
# Uso: ./scripts/migrar-para-zero-downtime.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() {
    echo -e "${BLUE}[MIGRAÇÃO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[MIGRAÇÃO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[MIGRAÇÃO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[MIGRAÇÃO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

cd "$PROJECT_DIR"

log "=========================================="
log "🔄 Migração para Zero-Downtime Deployment"
log "=========================================="
log ""

# 1. Verificar se Nginx está instalado
log "1/6 - Verificando Nginx..."

if ! command -v nginx &> /dev/null; then
    log_warn "Nginx não está instalado. Instalando..."
    sudo apt update
    sudo apt install -y nginx
    log_success "Nginx instalado"
else
    log_success "Nginx já está instalado"
fi

# 2. Parar deploy antigo (se estiver rodando)
log "2/6 - Parando deploy antigo..."

if docker ps --format '{{.Names}}' | grep -q "kanban-buzz-app"; then
    log "Container antigo encontrado. Parando..."
    docker compose down || true
    log_success "Container antigo parado"
else
    log "Nenhum container antigo encontrado"
fi

# 3. Iniciar Blue
log "3/6 - Iniciando versão Blue..."

docker compose -f docker-compose.blue.yml up -d --build || {
    log_error "Falha ao iniciar Blue"
    exit 1
}

log "Aguardando Blue iniciar..."
sleep 15

# Verificar se Blue está saudável
if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
    chmod +x "$SCRIPT_DIR/health-check.sh"
    if "$SCRIPT_DIR/health-check.sh" blue 60; then
        log_success "Blue está saudável"
    else
        log_error "Blue não ficou saudável"
        exit 1
    fi
else
    log_warn "Script health-check.sh não encontrado. Pulando verificação."
    sleep 10
fi

# 4. Configurar Nginx
log "4/6 - Configurando Nginx..."

NGINX_CONFIG="/etc/nginx/sites-available/kanban-buzz"
NGINX_ENABLED="/etc/nginx/sites-enabled/kanban-buzz"

# Copiar configuração
if [ -f "$PROJECT_DIR/nginx-reverse-proxy.conf" ]; then
    sudo cp "$PROJECT_DIR/nginx-reverse-proxy.conf" "$NGINX_CONFIG"
    log_success "Configuração do Nginx copiada"
else
    log_error "Arquivo nginx-reverse-proxy.conf não encontrado"
    exit 1
fi

# Criar link simbólico
sudo ln -sf "$NGINX_CONFIG" "$NGINX_ENABLED"

# Remover site padrão
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    sudo rm -f /etc/nginx/sites-enabled/default
    log "Site padrão removido"
fi

# Testar configuração
if sudo nginx -t; then
    sudo systemctl reload nginx || sudo nginx -s reload
    log_success "Nginx configurado e recarregado"
else
    log_error "Configuração do Nginx inválida"
    exit 1
fi

# 5. Verificar se está funcionando
log "5/6 - Verificando se está funcionando..."

sleep 5

if curl -f http://localhost/health > /dev/null 2>&1; then
    log_success "Aplicação está respondendo via Nginx!"
else
    log_warn "Aplicação pode não estar respondendo ainda"
    log "Verifique com: curl http://localhost/health"
fi

# 6. Tornar scripts executáveis
log "6/6 - Configurando scripts..."

chmod +x "$SCRIPT_DIR/health-check.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/deploy-zero-downtime.sh" 2>/dev/null || true

log_success "Scripts configurados"

# Resumo
log ""
log "=========================================="
log_success "✅ Migração concluída!"
log "=========================================="
log ""
log "Sistema migrado para Zero-Downtime Deployment"
log ""
log "Próximos passos:"
log "  1. Teste a aplicação: curl http://localhost/health"
log "  2. Para próximos deploys, use:"
log "     ./scripts/deploy-zero-downtime.sh"
log ""
log "Comandos úteis:"
log "  - Status: docker compose -f docker-compose.blue.yml ps"
log "  - Logs: docker compose -f docker-compose.blue.yml logs -f"
log "  - Health check: ./scripts/health-check.sh blue"
log ""






#!/bin/bash

# 🚀 Script: Deploy com Versionamento Automático
# Descrição: Faz deploy zero-downtime com registro automático de versões
# Uso: ./scripts/deploy-with-version.sh [--rollback] [--version <versão>] [--changes "descrição"]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION_MANAGER="$SCRIPT_DIR/version-manager.sh"
DEPLOY_SCRIPT="$SCRIPT_DIR/deploy-zero-downtime.sh"

# Variáveis
ROLLBACK_MODE=false
TARGET_VERSION=""
VERSION_TYPE="patch"
CHANGES=""
AUTO_CHANGES=false

# Funções de log
log() {
    echo -e "${BLUE}[DEPLOY-VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[DEPLOY-VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[DEPLOY-VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[DEPLOY-VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Parse de argumentos
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --rollback)
                ROLLBACK_MODE=true
                shift
                ;;
            --version)
                TARGET_VERSION="$2"
                shift 2
                ;;
            --changes)
                CHANGES="$2"
                shift 2
                ;;
            --type)
                VERSION_TYPE="$2"
                shift 2
                ;;
            --auto-changes)
                AUTO_CHANGES=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Argumento desconhecido: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Gerar descrição automática de mudanças baseada em git
generate_auto_changes() {
    if ! command -v git &> /dev/null; then
        echo "Deploy automático"
        return
    fi
    
    cd "$PROJECT_DIR"
    
    # Pegar último commit
    local last_commit=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
    local last_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "")
    
    if [ -n "$last_commit" ]; then
        echo "Deploy: $last_commit (commit: $last_hash)"
    else
        echo "Deploy automático"
    fi
}

# Mostrar ajuda
show_help() {
    cat <<EOF
${CYAN}🚀 Deploy com Versionamento Automático${NC}

${YELLOW}Uso:${NC}
  $0 [opções]

${YELLOW}Opções:${NC}
  ${GREEN}--rollback${NC}                    Fazer rollback para versão anterior
  ${GREEN}--version <versão>${NC}             Fazer rollback para versão específica (ex: 1.2.3)
  ${GREEN}--changes "descrição"${NC}          Descrição das mudanças desta versão
  ${GREEN}--type <tipo>${NC}                  Tipo de versão: patch (padrão), minor, major
  ${GREEN}--auto-changes${NC}                 Gerar descrição automaticamente do último commit git
  ${GREEN}--help${NC}                         Mostrar esta ajuda

${YELLOW}Exemplos:${NC}
  # Deploy normal com descrição manual
  $0 --changes "Correção de bug crítico no login"
  
  # Deploy com descrição automática do git
  $0 --auto-changes
  
  # Deploy de nova funcionalidade (minor)
  $0 --type minor --changes "Adicionada funcionalidade de relatórios"
  
  # Rollback para versão anterior
  $0 --rollback
  
  # Rollback para versão específica
  $0 --rollback --version 1.2.3

${YELLOW}Fluxo Automático:${NC}
  1. Cria nova versão automaticamente
  2. Registra mudanças no histórico
  3. Executa deploy zero-downtime
  4. Tag Docker com versão
  5. Retorna versão criada imediatamente

EOF
}

# Main
cd "$PROJECT_DIR"

# Tornar scripts executáveis
chmod +x "$VERSION_MANAGER" 2>/dev/null || true
chmod +x "$DEPLOY_SCRIPT" 2>/dev/null || true

# Parse argumentos
parse_args "$@"

log "=========================================="
log "🚀 Deploy com Versionamento Automático"
log "=========================================="
log ""

# Modo rollback
if [ "$ROLLBACK_MODE" = true ]; then
    log "🔄 Modo Rollback"
    
    if [ -n "$TARGET_VERSION" ]; then
        log "Fazendo rollback para versão: $TARGET_VERSION"
        "$VERSION_MANAGER" rollback "$TARGET_VERSION"
    else
        log "Fazendo rollback para versão anterior"
        # Pegar versão anterior do histórico
        if [ -f "$PROJECT_DIR/.versions.json" ]; then
            PREV_VERSION=$(jq -r '.versions[1].version // .versions[0].version' "$PROJECT_DIR/.versions.json" 2>/dev/null || echo "")
            if [ -n "$PREV_VERSION" ] && [ "$PREV_VERSION" != "null" ]; then
                log "Versão anterior detectada: $PREV_VERSION"
                "$VERSION_MANAGER" rollback "$PREV_VERSION"
            else
                log_error "Não foi possível detectar versão anterior"
                exit 1
            fi
        else
            log_error "Arquivo de versões não encontrado"
            exit 1
        fi
    fi
    
    log ""
    log "Executando deploy zero-downtime com rollback..."
    "$DEPLOY_SCRIPT" --rollback
    
    log_success "Rollback concluído!"
    exit 0
fi

# Modo deploy normal - criar nova versão
log "📦 Criando nova versão..."

# Gerar descrição de mudanças
if [ "$AUTO_CHANGES" = true ]; then
    CHANGES=$(generate_auto_changes)
    log "Descrição automática gerada: $CHANGES"
elif [ -z "$CHANGES" ]; then
    # Tentar gerar automaticamente se não foi fornecida
    CHANGES=$(generate_auto_changes)
    log_warn "Nenhuma descrição fornecida. Usando descrição automática: $CHANGES"
fi

# Criar nova versão
NEW_VERSION=$("$VERSION_MANAGER" create "$VERSION_TYPE" "$CHANGES")

if [ -z "$NEW_VERSION" ]; then
    log_error "Falha ao criar versão"
    exit 1
fi

log_success "Versão $NEW_VERSION criada com sucesso!"
log ""

# Gerar arquivo de versão para o frontend
log "📄 Gerando arquivo de versão para o frontend..."
chmod +x "$SCRIPT_DIR/generate-version-file.sh" 2>/dev/null || true
"$SCRIPT_DIR/generate-version-file.sh" || log_warn "Não foi possível gerar arquivo de versão (continuando...)"

# Tag Docker com versão (opcional - se quiser usar tags)
log "🏷️  Tagging Docker image com versão..."
docker tag kanban-buzz-app:latest "kanban-buzz-app:$NEW_VERSION" 2>/dev/null || log_warn "Não foi possível criar tag Docker (pode não existir imagem ainda)"

# Executar deploy zero-downtime
log ""
log "🚀 Executando deploy zero-downtime..."
log ""

"$DEPLOY_SCRIPT"

# Verificar se deploy foi bem-sucedido
if [ $? -eq 0 ]; then
    log ""
    log_success "════════════════════════════════════════════════════"
    log_success "✅ Deploy concluído com sucesso!"
    log_success "════════════════════════════════════════════════════"
    log ""
    log_success "Versão: ${GREEN}$NEW_VERSION${NC}"
    log_success "Mudanças: $CHANGES"
    log ""
    log "Para ver histórico de versões:"
    echo -e "  ${CYAN}./scripts/version-manager.sh list${NC}"
    log ""
    log "Para fazer rollback:"
    echo -e "  ${CYAN}./scripts/deploy-with-version.sh --rollback${NC}"
    echo -e "  ${CYAN}./scripts/deploy-with-version.sh --rollback --version $NEW_VERSION${NC}"
    log ""
    
    # Retornar versão imediatamente
    echo "$NEW_VERSION"
else
    log_error "Deploy falhou!"
    log_warn "Versão $NEW_VERSION foi criada mas deploy não foi concluído"
    log "Execute rollback se necessário:"
    echo -e "  ${CYAN}./scripts/deploy-with-version.sh --rollback${NC}"
    exit 1
fi






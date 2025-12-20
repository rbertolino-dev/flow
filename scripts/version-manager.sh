#!/bin/bash

# 📦 Script: Version Manager - Gerenciamento Automático de Versões
# Descrição: Gera versões automaticamente e registra mudanças a cada deploy
# Uso: ./scripts/version-manager.sh [comando] [opções]

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
VERSIONS_FILE="$PROJECT_DIR/.versions.json"
CHANGELOG_FILE="$PROJECT_DIR/CHANGELOG.md"

# Funções de log
log() {
    echo -e "${BLUE}[VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[VERSION]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Inicializar arquivo de versões se não existir
init_versions_file() {
    if [ ! -f "$VERSIONS_FILE" ]; then
        cat > "$VERSIONS_FILE" <<EOF
{
  "current_version": "0.0.0",
  "versions": [],
  "last_updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
        log "Arquivo de versões inicializado"
    fi
}

# Ler versão atual
get_current_version() {
    if [ -f "$VERSIONS_FILE" ]; then
        jq -r '.current_version' "$VERSIONS_FILE" 2>/dev/null || echo "0.0.0"
    else
        echo "0.0.0"
    fi
}

# Gerar próxima versão baseada no tipo (major, minor, patch)
generate_version() {
    local version_type="${1:-patch}"
    local current_version=$(get_current_version)
    
    # Parse da versão atual
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    local major="${VERSION_PARTS[0]:-0}"
    local minor="${VERSION_PARTS[1]:-0}"
    local patch="${VERSION_PARTS[2]:-0}"
    
    # Incrementar baseado no tipo
    case "$version_type" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch|*)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# Criar nova versão com mudanças
create_version() {
    local changes="${1:-Sem descrição de mudanças}"
    local version_type="${2:-patch}"
    local new_version=$(generate_version "$version_type")
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local git_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local git_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    
    init_versions_file
    
    # Criar objeto de versão
    local docker_image="kanban-buzz-app:$new_version"
    local version_json=$(jq -n \
        --arg version "$new_version" \
        --arg timestamp "$timestamp" \
        --arg changes "$changes" \
        --arg git_hash "$git_hash" \
        --arg git_branch "$git_branch" \
        --arg docker_image "$docker_image" \
        '{
            version: $version,
            timestamp: $timestamp,
            changes: $changes,
            git_hash: $git_hash,
            git_branch: $git_branch,
            docker_image: $docker_image
        }')
    
    # Adicionar ao histórico
    local temp_file=$(mktemp)
    local current_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    jq --argjson new_version "$version_json" \
        --arg timestamp "$current_timestamp" \
        '.current_version = $new_version.version |
         .versions = [$new_version] + .versions |
         .last_updated = $timestamp' \
        "$VERSIONS_FILE" > "$temp_file" && mv "$temp_file" "$VERSIONS_FILE"
    
    # Atualizar CHANGELOG.md
    update_changelog "$new_version" "$timestamp" "$changes" "$git_hash"
    
    log_success "Versão $new_version criada com sucesso!"
    echo "$new_version"
}

# Atualizar CHANGELOG.md
update_changelog() {
    local version="$1"
    local timestamp="$2"
    local changes="$3"
    local git_hash="$4"
    local date=$(date -d "$timestamp" +"%Y-%m-%d" 2>/dev/null || echo "$(date +"%Y-%m-%d")")
    
    # Criar CHANGELOG se não existir
    if [ ! -f "$CHANGELOG_FILE" ]; then
        cat > "$CHANGELOG_FILE" <<EOF
# 📋 Changelog - Histórico de Versões

Este arquivo registra todas as mudanças importantes do projeto.

---

EOF
    fi
    
    # Adicionar nova entrada no topo
    local temp_file=$(mktemp)
    {
        echo "## [$version] - $date"
        echo ""
        echo "### Mudanças"
        echo "$changes" | sed 's/^/- /'
        echo ""
        echo "**Detalhes:**"
        echo "- Git Hash: \`$git_hash\`"
        echo "- Timestamp: \`$timestamp\`"
        echo ""
        echo "---"
        echo ""
        cat "$CHANGELOG_FILE"
    } > "$temp_file" && mv "$temp_file" "$CHANGELOG_FILE"
}

# Listar versões
list_versions() {
    if [ ! -f "$VERSIONS_FILE" ]; then
        log_error "Arquivo de versões não encontrado. Execute 'create' primeiro."
        return 1
    fi
    
    local current=$(get_current_version)
    
    echo -e "\n${CYAN}════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}📦 Versões Disponíveis${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════${NC}\n"
    
    echo -e "${YELLOW}Versão Atual: ${GREEN}$current${NC}\n"
    
    jq -r '.versions[] | 
        "\(.version) | \(.timestamp) | \(.git_hash) | \(.git_branch)"' \
        "$VERSIONS_FILE" | while IFS='|' read -r version timestamp hash branch; do
        version=$(echo "$version" | xargs)
        timestamp=$(echo "$timestamp" | xargs)
        hash=$(echo "$hash" | xargs)
        branch=$(echo "$branch" | xargs)
        
        if [ "$version" = "$current" ]; then
            echo -e "${GREEN}→ $version${NC} | ${BLUE}$timestamp${NC} | ${CYAN}$hash${NC} | ${YELLOW}$branch${NC} ${GREEN}[ATUAL]${NC}"
        else
            echo -e "  $version | $timestamp | $hash | $branch"
        fi
    done
    
    echo ""
}

# Mostrar detalhes de uma versão
show_version() {
    local version="${1:-$(get_current_version)}"
    
    if [ ! -f "$VERSIONS_FILE" ]; then
        log_error "Arquivo de versões não encontrado"
        return 1
    fi
    
    local version_data=$(jq --arg version "$version" '.versions[] | select(.version == $version)' "$VERSIONS_FILE")
    
    if [ -z "$version_data" ] || [ "$version_data" = "null" ]; then
        log_error "Versão $version não encontrada"
        return 1
    fi
    
    echo -e "\n${CYAN}════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}📦 Detalhes da Versão: $version${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════${NC}\n"
    
    echo -e "${YELLOW}Versão:${NC} $(echo "$version_data" | jq -r '.version')"
    echo -e "${YELLOW}Timestamp:${NC} $(echo "$version_data" | jq -r '.timestamp')"
    echo -e "${YELLOW}Git Hash:${NC} $(echo "$version_data" | jq -r '.git_hash')"
    echo -e "${YELLOW}Git Branch:${NC} $(echo "$version_data" | jq -r '.git_branch')"
    echo -e "${YELLOW}Docker Image:${NC} $(echo "$version_data" | jq -r '.docker_image')"
    echo -e "\n${YELLOW}Mudanças:${NC}"
    echo "$version_data" | jq -r '.changes' | sed 's/^/  /'
    echo ""
}

# Rollback para versão anterior
rollback_to_version() {
    local target_version="$1"
    
    if [ -z "$target_version" ]; then
        log_error "Versão de destino não especificada"
        echo "Uso: $0 rollback <versão>"
        return 1
    fi
    
    if [ ! -f "$VERSIONS_FILE" ]; then
        log_error "Arquivo de versões não encontrado"
        return 1
    fi
    
    # Verificar se versão existe
    local version_exists=$(jq --arg version "$target_version" '.versions[] | select(.version == $version)' "$VERSIONS_FILE")
    
    if [ -z "$version_exists" ] || [ "$version_exists" = "null" ]; then
        log_error "Versão $target_version não encontrada no histórico"
        list_versions
        return 1
    fi
    
    log_warn "⚠️  ATENÇÃO: Você está prestes a fazer rollback para versão $target_version"
    log_warn "Isso irá atualizar o arquivo de versões. O deploy deve ser feito manualmente."
    
    # Atualizar versão atual
    local temp_file=$(mktemp)
    jq --arg version "$target_version" '.current_version = $version | .last_updated = now | todateiso8601' \
        "$VERSIONS_FILE" > "$temp_file" && mv "$temp_file" "$VERSIONS_FILE"
    
    log_success "Versão atual atualizada para $target_version"
    log "Execute o deploy para aplicar o rollback:"
    echo -e "${CYAN}  ./scripts/deploy-zero-downtime.sh --rollback${NC}"
}

# Obter resumo das mudanças recentes
get_recent_changes() {
    local limit="${1:-5}"
    
    if [ ! -f "$VERSIONS_FILE" ]; then
        log_error "Arquivo de versões não encontrado"
        return 1
    fi
    
    echo -e "\n${CYAN}════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}📋 Últimas $limit Mudanças${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════${NC}\n"
    
    jq -r --argjson limit "$limit" '.versions[0:$limit][] | 
        "\(.version) - \(.timestamp)\n  \(.changes)\n"' \
        "$VERSIONS_FILE" | while IFS= read -r line; do
        if [[ "$line" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
            echo -e "${GREEN}$line${NC}"
        else
            echo "  $line"
        fi
    done
    
    echo ""
}

# Menu de ajuda
show_help() {
    cat <<EOF
${CYAN}📦 Version Manager - Gerenciamento Automático de Versões${NC}

${YELLOW}Uso:${NC}
  $0 [comando] [opções]

${YELLOW}Comandos:${NC}
  ${GREEN}create${NC} [tipo] [mudanças]    Criar nova versão
    tipos: patch (padrão), minor, major
    exemplo: $0 create patch "Correção de bug no login"
  
  ${GREEN}list${NC}                        Listar todas as versões
  ${GREEN}show${NC} [versão]               Mostrar detalhes de uma versão
  ${GREEN}current${NC}                     Mostrar versão atual
  ${GREEN}rollback${NC} <versão>           Fazer rollback para versão anterior
  ${GREEN}changes${NC} [limite]            Mostrar últimas mudanças (padrão: 5)
  ${GREEN}help${NC}                        Mostrar esta ajuda

${YELLOW}Exemplos:${NC}
  # Criar nova versão patch com mudanças
  $0 create patch "Correção de bug crítico no sistema de pagamento"
  
  # Criar nova versão minor
  $0 create minor "Adicionada nova funcionalidade de relatórios"
  
  # Listar versões
  $0 list
  
  # Ver detalhes da versão atual
  $0 show
  
  # Fazer rollback
  $0 rollback 1.2.3
  
  # Ver últimas 10 mudanças
  $0 changes 10

EOF
}

# Main
cd "$PROJECT_DIR"

# Verificar se jq está instalado e instalar se necessário
if ! command -v jq &> /dev/null; then
    log_warn "jq não está instalado. Tentando instalar automaticamente..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y jq > /dev/null 2>&1 || {
            log_error "Falha ao instalar jq automaticamente. Instale manualmente: apt-get install -y jq"
            exit 1
        }
        log_success "jq instalado com sucesso!"
    else
        log_error "jq não está instalado e apt-get não está disponível. Instale jq manualmente."
        exit 1
    fi
fi

COMMAND="${1:-help}"

case "$COMMAND" in
    create)
        VERSION_TYPE="${2:-patch}"
        CHANGES="${3:-Sem descrição de mudanças}"
        create_version "$CHANGES" "$VERSION_TYPE"
        ;;
    list)
        list_versions
        ;;
    show)
        VERSION="${2:-}"
        show_version "$VERSION"
        ;;
    current)
        CURRENT=$(get_current_version)
        echo -e "${GREEN}Versão Atual: $CURRENT${NC}"
        ;;
    rollback)
        TARGET_VERSION="$2"
        rollback_to_version "$TARGET_VERSION"
        ;;
    changes)
        LIMIT="${2:-5}"
        get_recent_changes "$LIMIT"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Comando desconhecido: $COMMAND"
        show_help
        exit 1
        ;;
esac


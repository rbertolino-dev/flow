#!/bin/bash

# 📊 Script: Show Versions - Visualização Bonita de Versões
# Descrição: Mostra versões de forma visual e organizada
# Uso: ./scripts/show-versions.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSIONS_FILE="$PROJECT_DIR/.versions.json"

# Funções
print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}           📦 SISTEMA DE VERSIONAMENTO - DASHBOARD           ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
}

print_separator() {
    echo -e "${BLUE}────────────────────────────────────────────────────────────────${NC}"
}

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq não está instalado${NC}"
    echo "Instale com: apt-get install -y jq"
    exit 1
fi

cd "$PROJECT_DIR"

# Verificar se arquivo existe
if [ ! -f "$VERSIONS_FILE" ]; then
    print_header
    echo -e "${YELLOW}⚠️  Nenhuma versão registrada ainda${NC}\n"
    echo -e "${BLUE}Execute seu primeiro deploy:${NC}"
    echo -e "  ${GREEN}./scripts/deploy-with-version.sh --auto-changes${NC}\n"
    exit 0
fi

# Ler dados
CURRENT_VERSION=$(jq -r '.current_version' "$VERSIONS_FILE" 2>/dev/null || echo "0.0.0")
TOTAL_VERSIONS=$(jq '.versions | length' "$VERSIONS_FILE" 2>/dev/null || echo "0")
LAST_UPDATED=$(jq -r '.last_updated' "$VERSIONS_FILE" 2>/dev/null || echo "N/A")

# Header
print_header

# Informações gerais
echo -e "${WHITE}📊 Informações Gerais${NC}"
print_separator
echo -e "${YELLOW}Versão Atual:${NC} ${GREEN}$CURRENT_VERSION${NC}"
echo -e "${YELLOW}Total de Versões:${NC} ${BLUE}$TOTAL_VERSIONS${NC}"
echo -e "${YELLOW}Última Atualização:${NC} ${CYAN}$LAST_UPDATED${NC}"
echo ""

# Lista de versões
echo -e "${WHITE}📋 Histórico de Versões${NC}"
print_separator

# Verificar se há versões
if [ "$TOTAL_VERSIONS" = "0" ]; then
    echo -e "${YELLOW}Nenhuma versão registrada ainda${NC}\n"
else
    # Mostrar últimas 10 versões
    jq -r '.versions[0:10][] | 
        "\(.version)|\(.timestamp)|\(.git_hash)|\(.git_branch)|\(.changes)"' \
        "$VERSIONS_FILE" | while IFS='|' read -r version timestamp hash branch changes; do
        
        # Limpar espaços
        version=$(echo "$version" | xargs)
        timestamp=$(echo "$timestamp" | xargs)
        hash=$(echo "$hash" | xargs)
        branch=$(echo "$branch" | xargs)
        changes=$(echo "$changes" | xargs)
        
        # Formatar data
        formatted_date=$(date -d "$timestamp" +"%d/%m/%Y %H:%M" 2>/dev/null || echo "$timestamp")
        
        # Destacar versão atual
        if [ "$version" = "$CURRENT_VERSION" ]; then
            echo -e "${GREEN}▶ ${WHITE}$version${NC} ${GREEN}[ATUAL]${NC}"
        else
            echo -e "  ${CYAN}$version${NC}"
        fi
        
        echo -e "    ${BLUE}📅${NC} $formatted_date"
        echo -e "    ${MAGENTA}🔀${NC} $branch ${YELLOW}($hash)${NC}"
        
        # Mostrar mudanças (primeira linha apenas)
        first_line=$(echo "$changes" | head -n 1)
        if [ ${#first_line} -gt 60 ]; then
            first_line="${first_line:0:57}..."
        fi
        echo -e "    ${WHITE}📝${NC} $first_line"
        echo ""
    done
fi

# Estatísticas
echo -e "${WHITE}📈 Estatísticas${NC}"
print_separator

# Contar por tipo (major, minor, patch)
MAJOR_COUNT=$(jq -r '.versions[] | .version | split(".")[0]' "$VERSIONS_FILE" 2>/dev/null | sort -u | wc -l)
MINOR_COUNT=$(jq -r '.versions[] | .version | split(".")[0:2] | join(".")' "$VERSIONS_FILE" 2>/dev/null | sort -u | wc -l)
PATCH_COUNT=$TOTAL_VERSIONS

echo -e "${YELLOW}Versões Major:${NC} ${BLUE}$MAJOR_COUNT${NC}"
echo -e "${YELLOW}Versões Minor:${NC} ${BLUE}$MINOR_COUNT${NC}"
echo -e "${YELLOW}Total de Patches:${NC} ${BLUE}$PATCH_COUNT${NC}"
echo ""

# Comandos úteis
echo -e "${WHITE}🔧 Comandos Úteis${NC}"
print_separator
echo -e "${GREEN}Ver detalhes de uma versão:${NC}"
echo -e "  ${CYAN}./scripts/version-manager.sh show $CURRENT_VERSION${NC}"
echo ""
echo -e "${GREEN}Fazer novo deploy:${NC}"
echo -e "  ${CYAN}./scripts/deploy-with-version.sh --auto-changes${NC}"
echo ""
echo -e "${GREEN}Fazer rollback:${NC}"
echo -e "  ${CYAN}./scripts/deploy-with-version.sh --rollback${NC}"
echo ""

# Footer
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}\n"






#!/bin/bash

# 🔍 Script: Identificar Último Deploy
# Descrição: Identifica qual foi o último deploy usando duplo método:
#   - Método Primário: Timestamp da imagem Docker
#   - Método Secundário: Arquivo .last-deploy
# Uso: ./scripts/get-last-deploy.sh [--json]

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
LAST_DEPLOY_FILE="$PROJECT_DIR/.last-deploy"

# Verificar se quer output JSON
JSON_OUTPUT=false
if [ "$1" = "--json" ]; then
    JSON_OUTPUT=true
fi

# Função para obter timestamp da imagem Docker
get_image_timestamp() {
    local version=$1
    local image_name="kanban-buzz-95241-app-${version}:latest"
    
    if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image_name}$"; then
        docker inspect "$image_name" --format='{{.Created}}' 2>/dev/null | xargs -I {} date -d {} +%s 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Função para obter image ID
get_image_id() {
    local version=$1
    local image_name="kanban-buzz-95241-app-${version}:latest"
    
    if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${image_name}$"; then
        docker inspect "$image_name" --format='{{.Id}}' 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# Método Primário: Comparar timestamps das imagens Docker
BLUE_TIMESTAMP=$(get_image_timestamp "blue")
GREEN_TIMESTAMP=$(get_image_timestamp "green")

# Método Secundário: Ler arquivo .last-deploy se existir
FILE_VERSION=""
FILE_TIMESTAMP=""
FILE_IMAGE_ID=""
FILE_DEPLOY_ID=""

if [ -f "$LAST_DEPLOY_FILE" ]; then
    FILE_VERSION=$(jq -r '.version // ""' "$LAST_DEPLOY_FILE" 2>/dev/null || echo "")
    FILE_TIMESTAMP=$(jq -r '.timestamp // ""' "$LAST_DEPLOY_FILE" 2>/dev/null || echo "")
    FILE_IMAGE_ID=$(jq -r '.image_id // ""' "$LAST_DEPLOY_FILE" 2>/dev/null || echo "")
    FILE_DEPLOY_ID=$(jq -r '.deploy_id // ""' "$LAST_DEPLOY_FILE" 2>/dev/null || echo "")
fi

# Determinar último deploy usando método primário (timestamp)
LAST_DEPLOY_VERSION=""
LAST_DEPLOY_TIMESTAMP=""
LAST_DEPLOY_IMAGE_ID=""

if [ "$BLUE_TIMESTAMP" -gt "$GREEN_TIMESTAMP" ]; then
    LAST_DEPLOY_VERSION="blue"
    LAST_DEPLOY_TIMESTAMP="$BLUE_TIMESTAMP"
    LAST_DEPLOY_IMAGE_ID=$(get_image_id "blue")
elif [ "$GREEN_TIMESTAMP" -gt "$BLUE_TIMESTAMP" ]; then
    LAST_DEPLOY_VERSION="green"
    LAST_DEPLOY_TIMESTAMP="$GREEN_TIMESTAMP"
    LAST_DEPLOY_IMAGE_ID=$(get_image_id "green")
elif [ "$BLUE_TIMESTAMP" -gt "0" ] && [ "$GREEN_TIMESTAMP" -eq "0" ]; then
    LAST_DEPLOY_VERSION="blue"
    LAST_DEPLOY_TIMESTAMP="$BLUE_TIMESTAMP"
    LAST_DEPLOY_IMAGE_ID=$(get_image_id "blue")
elif [ "$GREEN_TIMESTAMP" -gt "0" ] && [ "$BLUE_TIMESTAMP" -eq "0" ]; then
    LAST_DEPLOY_VERSION="green"
    LAST_DEPLOY_TIMESTAMP="$GREEN_TIMESTAMP"
    LAST_DEPLOY_IMAGE_ID=$(get_image_id "green")
else
    # Se timestamps são iguais ou ambos zero, usar arquivo como fallback
    if [ -n "$FILE_VERSION" ] && [ "$FILE_VERSION" != "null" ]; then
        LAST_DEPLOY_VERSION="$FILE_VERSION"
        LAST_DEPLOY_TIMESTAMP=$(date -d "$FILE_TIMESTAMP" +%s 2>/dev/null || echo "0")
        LAST_DEPLOY_IMAGE_ID="$FILE_IMAGE_ID"
    else
        # Fallback final: assumir blue se nenhuma informação disponível
        LAST_DEPLOY_VERSION="blue"
        LAST_DEPLOY_TIMESTAMP="0"
        LAST_DEPLOY_IMAGE_ID=""
    fi
fi

# Verificar se arquivo confirma resultado (validação cruzada)
if [ -n "$FILE_VERSION" ] && [ "$FILE_VERSION" != "null" ] && [ "$FILE_VERSION" != "$LAST_DEPLOY_VERSION" ]; then
    # Arquivo discorda - usar timestamp como verdade (mais confiável)
    # Mas logar aviso se não for JSON output
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${YELLOW}[AVISO]${NC} Arquivo .last-deploy indica '$FILE_VERSION' mas timestamp indica '$LAST_DEPLOY_VERSION'. Usando timestamp (mais confiável)." >&2
    fi
fi

# Output
if [ "$JSON_OUTPUT" = true ]; then
    # Converter timestamp para ISO8601
    if [ "$LAST_DEPLOY_TIMESTAMP" != "0" ] && [ -n "$LAST_DEPLOY_TIMESTAMP" ]; then
        ISO_TIMESTAMP=$(date -d "@${LAST_DEPLOY_TIMESTAMP}" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")
    else
        ISO_TIMESTAMP=""
    fi
    
    jq -n \
        --arg version "$LAST_DEPLOY_VERSION" \
        --arg timestamp "$ISO_TIMESTAMP" \
        --arg image_id "$LAST_DEPLOY_IMAGE_ID" \
        --arg deploy_id "$FILE_DEPLOY_ID" \
        --arg method "docker_timestamp" \
        '{
            version: $version,
            timestamp: $timestamp,
            image_id: $image_id,
            deploy_id: $deploy_id,
            method: $method
        }'
else
    echo "$LAST_DEPLOY_VERSION"
fi

exit 0








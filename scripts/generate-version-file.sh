#!/bin/bash

# Script: Gerar arquivo de versão para o frontend
# Descrição: Cria version.json no diretório public/ com a versão atual

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSIONS_FILE="$PROJECT_DIR/.versions.json"
VERSION_OUTPUT="$PROJECT_DIR/public/version.json"

# Criar diretório public se não existir
mkdir -p "$PROJECT_DIR/public"

# Verificar se jq está instalado
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq não está instalado. Criando versão básica..."
    cat > "$VERSION_OUTPUT" <<EOF
{
  "version": "0.0.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "changes": "Versão não disponível"
}
EOF
    exit 0
fi

if [ ! -f "$VERSIONS_FILE" ]; then
    echo "⚠️  Arquivo de versões não encontrado. Criando versão básica..."
    cat > "$VERSION_OUTPUT" <<EOF
{
  "version": "0.0.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "changes": "Versão inicial"
}
EOF
    exit 0
fi

# Pegar versão atual
CURRENT_VERSION=$(jq -r '.current_version' "$VERSIONS_FILE" 2>/dev/null || echo "0.0.0")
VERSION_DATA=$(jq --arg version "$CURRENT_VERSION" '.versions[] | select(.version == $version)' "$VERSIONS_FILE" 2>/dev/null)

if [ -z "$VERSION_DATA" ] || [ "$VERSION_DATA" = "null" ]; then
    # Se não encontrar, criar versão básica
    cat > "$VERSION_OUTPUT" <<EOF
{
  "version": "$CURRENT_VERSION",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "changes": "Versão atual"
}
EOF
else
    # Usar dados completos da versão
    echo "$VERSION_DATA" > "$VERSION_OUTPUT"
fi

echo "✅ Arquivo de versão gerado: $VERSION_OUTPUT"


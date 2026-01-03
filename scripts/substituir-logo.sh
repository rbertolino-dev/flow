#!/bin/bash

# Script para substituir a logo do AgilizeFLOW
# Uso: ./scripts/substituir-logo.sh [URL_DA_LOGO]

LOGO_DIR="src/assets"
LOGO_FILE="$LOGO_DIR/agilize-logo.png"
TEMP_FILE="/tmp/agilizeflow-logo.png"

echo "🖼️  Substituindo logo do AgilizeFLOW..."

# Se URL fornecida, baixar
if [ -n "$1" ]; then
    echo "📥 Baixando logo de: $1"
    if curl -f -L "$1" -o "$TEMP_FILE" 2>/dev/null; then
        echo "✅ Logo baixada com sucesso"
        mv "$TEMP_FILE" "$LOGO_FILE"
        echo "✅ Logo substituída em: $LOGO_FILE"
        exit 0
    else
        echo "❌ Erro ao baixar logo da URL fornecida"
        exit 1
    fi
fi

# Se arquivo local fornecido
if [ -n "$2" ] && [ -f "$2" ]; then
    echo "📋 Copiando logo de: $2"
    cp "$2" "$LOGO_FILE"
    echo "✅ Logo substituída em: $LOGO_FILE"
    exit 0
fi

echo "ℹ️  Uso:"
echo "   ./scripts/substituir-logo.sh [URL_DA_LOGO]"
echo "   ou"
echo "   ./scripts/substituir-logo.sh [URL] [CAMINHO_ARQUIVO_LOCAL]"
echo ""
echo "📝 Exemplo:"
echo "   ./scripts/substituir-logo.sh https://exemplo.com/logo.png"
echo "   ou"
echo "   ./scripts/substituir-logo.sh https://exemplo.com/logo.png /caminho/local/logo.png"




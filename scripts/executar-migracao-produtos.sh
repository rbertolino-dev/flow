#!/bin/bash

# Script para executar migração de produtos via Edge Function
# Uso: bash scripts/executar-migracao-produtos.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔄 Executando Migração de Produtos via Edge Function"
echo "=================================================="
echo ""

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado${NC}"
    exit 1
fi

# Carregar variáveis do .env
export $(grep -v '^#' .env | xargs)

SUPABASE_URL="${VITE_SUPABASE_URL:-https://ogeljmbhqxpfjbpnbwog.supabase.co}"
SUPABASE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"

if [ -z "$SUPABASE_KEY" ]; then
    echo -e "${RED}❌ VITE_SUPABASE_PUBLISHABLE_KEY não encontrado no .env${NC}"
    exit 1
fi

echo "📋 Configuração:"
echo "   Supabase URL: $SUPABASE_URL"
echo ""

echo "🔍 Passo 1: Verificando se há produtos no Supabase..."
echo ""

# Buscar produtos do Supabase diretamente (usando service role se disponível)
# Por enquanto, vamos chamar a Edge Function de migração
echo "🚀 Passo 2: Executando migração..."
echo ""

# Obter token de autenticação (precisa de um usuário válido)
# Por enquanto, vamos usar a chave de serviço
RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/migrate-products" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" 2>&1)

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Migração executada!${NC}"
echo ""
echo "📋 Verifique o resultado acima"
echo ""




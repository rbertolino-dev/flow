#!/bin/bash

# Script completo para configurar produtos no PostgreSQL
# Executa migration e configura variáveis de ambiente automaticamente
# Uso: bash scripts/setup-products-completo.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🚀 Configuração Completa de Produtos no PostgreSQL"
echo "=================================================="
echo ""

# Passo 1: Aplicar migration
echo "📦 Passo 1/2: Aplicando migration no PostgreSQL..."
bash "$SCRIPT_DIR/aplicar-migration-products-postgres.sh"

if [ $? -ne 0 ]; then
    echo "❌ Erro ao aplicar migration"
    exit 1
fi

echo ""
echo "✅ Migration aplicada com sucesso!"
echo ""

# Passo 2: Configurar secrets
echo "🔐 Passo 2/2: Configurando variáveis de ambiente..."
bash "$SCRIPT_DIR/configurar-products-secrets.sh"

if [ $? -ne 0 ]; then
    echo "❌ Erro ao configurar secrets"
    exit 1
fi

echo ""
echo "✅ Configuração completa concluída!"
echo ""
echo "📋 Resumo:"
echo "   ✅ Tabela 'products' criada no PostgreSQL"
echo "   ✅ Variáveis de ambiente configuradas na Edge Function"
echo ""
echo "🎯 Próximos passos:"
echo "   1. Fazer deploy da Edge Function products (se necessário)"
echo "   2. Testar criação de produto via interface"
echo "   3. Validar que produtos aparecem corretamente"
echo ""


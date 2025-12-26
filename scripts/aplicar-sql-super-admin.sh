#!/bin/bash

# Script para aplicar SQL de super admin no Supabase
# Tenta aplicar automaticamente, se não conseguir, mostra instruções

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SQL_FILE="$PROJECT_ROOT/fix-can-create-evolution-instance-com-super-admin.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 APLICANDO SQL SUPER ADMIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Arquivo SQL não encontrado: $SQL_FILE"
    exit 1
fi

echo "📄 Arquivo: $(basename $SQL_FILE)"
echo ""

# Tentar aplicar via migration repair + push
echo "📦 Tentando aplicar via Supabase CLI..."

cd "$PROJECT_ROOT"

# Marcar migration como aplicada (já fizemos isso)
# Agora vamos tentar aplicar o SQL diretamente

# Como não podemos executar SQL diretamente via CLI sem migration,
# vamos mostrar instruções claras

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  APLICAÇÃO AUTOMÁTICA NÃO DISPONÍVEL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Para aplicar o SQL, siga estes passos:"
echo ""
echo "1. Acesse o Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo ""
echo "2. Abra o arquivo SQL:"
echo "   $SQL_FILE"
echo ""
echo "3. Copie TODO o conteúdo do arquivo"
echo ""
echo "4. Cole no SQL Editor do Supabase"
echo ""
echo "5. Clique em RUN (ou pressione Ctrl+Enter)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Mostrar preview do SQL
echo "📝 Preview do SQL (primeiras 10 linhas):"
echo ""
head -10 "$SQL_FILE"
echo ""
echo "... (resto do arquivo)"
echo ""

echo "✅ Após aplicar, a função can_create_evolution_instance terá suporte a super admin!"
echo ""


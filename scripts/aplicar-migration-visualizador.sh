#!/bin/bash

# Script para aplicar migration do usuário visualizador
# Uso: bash scripts/aplicar-migration-visualizador.sh

set -e

echo "🔧 Aplicando migration do usuário visualizador..."
echo ""

# Carregar configuração do Supabase
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado"
    echo "   Instale com: npm install -g supabase"
    exit 1
fi

# Verificar se está logado
if ! supabase projects list &> /dev/null; then
    echo "❌ Não está logado no Supabase CLI"
    echo "   Execute: supabase login"
    exit 1
fi

echo "📋 Migration a ser aplicada:"
echo "   supabase/migrations/20251222024655_create_viewer_user.sql"
echo ""

# Ler conteúdo da migration
MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20251222024655_create_viewer_user.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "📝 Conteúdo da migration:"
echo "---"
head -20 "$MIGRATION_FILE"
echo "..."
echo "---"
echo ""

# Aplicar via Supabase CLI (usando db push com include-all)
echo "🚀 Aplicando migration..."
echo ""

# Tentar aplicar via SQL direto
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

echo "⚠️  Para aplicar esta migration, você tem duas opções:"
echo ""
echo "1️⃣  Via Supabase Dashboard (Recomendado):"
echo "   a) Acesse: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "   b) Cole o conteúdo do arquivo: $MIGRATION_FILE"
echo "   c) Execute o SQL"
echo ""
echo "2️⃣  Via Supabase CLI (se tiver permissões):"
echo "   supabase db push --include-all"
echo ""

echo "✅ Migration criada com sucesso!"
echo ""
echo "📄 Arquivo: $MIGRATION_FILE"
echo ""
echo "🔐 Após aplicar, as credenciais estarão disponíveis em:"
echo "   CREDENCIAIS-VISUALIZADOR-POSTGRESQL.md"
echo ""


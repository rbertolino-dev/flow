#!/bin/bash

# Script para aplicar migration de storage via Supabase API
# Uso: ./scripts/aplicar-migration-storage.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20250117000001_create_contract_storage_tables.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 APLICANDO MIGRATION DE STORAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📄 Migration: $(basename $MIGRATION_FILE)"
echo ""

# Verificar se supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não está instalado"
    echo "💡 Instale com: npm install -g supabase"
    exit 1
fi

# Verificar se está linkado
if [ ! -f "$PROJECT_ROOT/supabase/.temp/project-ref" ]; then
    echo "🔗 Linkando projeto Supabase..."
    cd "$PROJECT_ROOT"
    
    # Tentar linkar (pode precisar de token)
    if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
        echo "⚠️  SUPABASE_ACCESS_TOKEN não configurado"
        echo "💡 Configure com: export SUPABASE_ACCESS_TOKEN=seu_token"
        echo ""
        echo "📋 Alternativa: Aplique manualmente via Supabase Dashboard SQL Editor"
        echo "   1. Acesse: https://supabase.com/dashboard/project/[PROJECT_ID]/sql"
        echo "   2. Cole o conteúdo de: $MIGRATION_FILE"
        echo "   3. Execute"
        exit 1
    fi
    
    # Tentar linkar (pode falhar se já estiver linkado)
    supabase link --project-ref "$SUPABASE_PROJECT_ID" 2>/dev/null || true
fi

echo "⚡ Aplicando migration..."
cd "$PROJECT_ROOT"

# Aplicar via db push (aplicará apenas esta migration se for a única nova)
OUTPUT=$(echo "y" | supabase db push --include-all 2>&1) || true

if echo "$OUTPUT" | grep -qiE "success|applied|completed"; then
    echo ""
    echo "✅ Migration aplicada com sucesso!"
    echo ""
    echo "📊 Tabelas criadas:"
    echo "   - contract_backups"
    echo "   - contract_storage_migrations"
    echo "   - contract_storage_usage"
    echo "   - contract_storage_billing"
    echo "   - contract_storage_pricing"
    echo ""
else
    echo ""
    echo "⚠️  Migration pode não ter sido aplicada automaticamente"
    echo ""
    echo "📋 Aplique manualmente via Supabase Dashboard SQL Editor:"
    echo "   1. Acesse: https://supabase.com/dashboard/project/[PROJECT_ID]/sql"
    echo "   2. Cole o conteúdo de: $MIGRATION_FILE"
    echo "   3. Execute"
    echo ""
    echo "📄 Conteúdo da migration:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    head -20 "$MIGRATION_FILE"
    echo "..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi


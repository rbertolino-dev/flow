#!/bin/bash

# Script para aplicar migration de repetição, combo e cancelamento
# Aplica a migration 20260115000001_add_repeat_combo_cancel_to_scheduled_messages.sql

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20260115000001_add_repeat_combo_cancel_to_scheduled_messages.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Aplicar Migration: Repeat, Combo e Cancel"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Migration: $(basename $MIGRATION_FILE)"
echo ""

# Método 1: Tentar via Supabase CLI
if command -v supabase &> /dev/null; then
    echo "1️⃣  Tentando via Supabase CLI..."
    
    # Verificar se está linkado
    if [ ! -f "supabase/.temp/project-ref" ]; then
        echo "   🔗 Linkando projeto..."
        export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
        export SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-ogeljmbhqxpfjbpnbwog}"
        supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    fi
    
    # Tentar aplicar via db execute
    if supabase db execute --file "$MIGRATION_FILE" 2>&1; then
        echo ""
        echo "✅ Migration aplicada via Supabase CLI!"
        echo ""
        echo "🔄 Recarregue a página do funil de vendas para testar."
        exit 0
    else
        echo "⚠️  Supabase CLI não conseguiu aplicar"
    fi
else
    echo "⚠️  Supabase CLI não encontrado"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 APLICAR MANUALMENTE VIA SQL EDITOR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo ""
echo "2. Cole o SQL abaixo e execute (Run):"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$MIGRATION_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Após aplicar, recarregue a página do funil de vendas"
echo ""

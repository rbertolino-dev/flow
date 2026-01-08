#!/bin/bash

# ============================================
# Aplicar Migration: RLS Policies para lead_tags
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20260108000002_add_lead_tags_rls_policies.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "🔧 Migration: Adicionar RLS Policies para lead_tags"
echo "📄 Arquivo: $MIGRATION_FILE"
echo ""
echo "📝 Para aplicar esta migration:"
echo "   1. Acesse: https://supabase.com/dashboard"
echo "   2. Selecione seu projeto"
echo "   3. Vá em SQL Editor"
echo "   4. Cole o conteúdo abaixo e execute:"
echo ""
echo "=========================================="
cat "$MIGRATION_FILE"
echo "=========================================="
echo ""
echo "✅ Após aplicar, as políticas RLS permitirão adicionar tags aos leads!"


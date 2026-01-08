#!/bin/bash

# Script para aplicar correção de RLS de lead_tags
# Mostra o SQL para aplicar manualmente no Supabase SQL Editor

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20260108000004_fix_lead_tags_rls_robust.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "🔧 ============================================"
echo "🔧 Correção de RLS para lead_tags"
echo "🔧 ============================================"
echo ""
echo "📝 INSTRUÇÕES PARA APLICAR:"
echo ""
echo "1. Acesse o Supabase SQL Editor:"
echo "   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo ""
echo "2. Cole o SQL abaixo e execute (Run):"
echo ""
echo "=========================================="
cat "$MIGRATION_FILE"
echo "=========================================="
echo ""
echo "✅ Após aplicar, recarregue a página e tente adicionar tags novamente"
echo ""
echo "🔍 Se o erro persistir, verifique:"
echo "   - Se o usuário está na tabela organization_members"
echo "   - Se o lead tem organization_id correto"
echo "   - Se a tag tem organization_id correto"
echo ""



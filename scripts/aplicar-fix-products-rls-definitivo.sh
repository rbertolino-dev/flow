#!/bin/bash

# ============================================
# Aplicar Fix DEFINITIVO: RLS de Produtos
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20260127000001_fix_products_rls_foreign_key_definitive.sql"

echo "🚀 Aplicando Fix DEFINITIVO: RLS de Produtos para Foreign Keys"
echo "📄 Arquivo: $MIGRATION_FILE"
echo ""

echo "📝 SQL para aplicar manualmente no Supabase Dashboard:"
echo ""
echo "=========================================="
cat "$MIGRATION_FILE"
echo "=========================================="
echo ""
echo "📋 INSTRUÇÕES:"
echo ""
echo "1. Acesse: https://supabase.com/dashboard"
echo "2. Selecione seu projeto"
echo "3. Vá em 'SQL Editor' (menu lateral)"
echo "4. Cole o SQL acima e clique em 'Run'"
echo ""
echo "✅ Esta migration:"
echo "   - Cria função SECURITY DEFINER para verificar produtos"
echo "   - Ajusta política RLS para permitir verificação de foreign keys"
echo "   - Cria trigger para validar produtos antes de inserir"
echo "   - Resolve o erro 23503 (foreign key constraint)"
echo ""

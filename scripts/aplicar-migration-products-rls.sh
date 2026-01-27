#!/bin/bash

# ============================================
# Aplicar Migration: RLS Público para Produtos
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20260126000001_add_public_products_rls_for_landing_pages.sql"

echo "🚀 Aplicando migration: RLS Público para Produtos"
echo "📄 Arquivo: $MIGRATION_FILE"
echo ""

# Método 1: Tentar via Supabase CLI
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI encontrado"
    
    # Verificar se está linkado
    if [ -f ".supabase/config.toml" ] || supabase projects list &>/dev/null; then
        echo "📤 Aplicando via Supabase CLI..."
        
        # Ler SQL
        SQL_CONTENT=$(cat "$MIGRATION_FILE")
        
        # Tentar aplicar via db push
        if supabase db push 2>&1 | tee /tmp/migration_products_rls.log; then
            echo ""
            echo "✅ Migration aplicada com sucesso via Supabase CLI!"
            exit 0
        else
            echo ""
            echo "⚠️  Supabase CLI não conseguiu aplicar automaticamente"
            echo ""
        fi
    else
        echo "⚠️  Projeto não está linkado ao Supabase CLI"
        echo ""
    fi
else
    echo "⚠️  Supabase CLI não encontrado"
    echo ""
fi

# Método 2: Mostrar instruções para aplicar manualmente
echo "📝 INSTRUÇÕES PARA APLICAR MANUALMENTE:"
echo ""
echo "1. Acesse o Supabase Dashboard:"
echo "   https://supabase.com/dashboard"
echo ""
echo "2. Selecione seu projeto"
echo ""
echo "3. Vá em 'SQL Editor' (menu lateral)"
echo ""
echo "4. Cole o SQL abaixo e clique em 'Run':"
echo ""
echo "=========================================="
cat "$MIGRATION_FILE"
echo "=========================================="
echo ""
echo "✅ Após aplicar, os produtos aparecerão na landing page pública!"
echo ""

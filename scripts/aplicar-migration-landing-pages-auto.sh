#!/bin/bash
# Script para aplicar migration de Landing Pages automaticamente via Supabase Management API

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="supabase/migrations/20260123000001_create_landing_pages.sql"

echo "🚀 Aplicando migration de Landing Pages automaticamente..."

# Ler SQL da migration
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo não encontrado: $MIGRATION_FILE"
    exit 1
fi

SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Tentar aplicar via Supabase CLI primeiro
if command -v supabase &> /dev/null; then
    echo "📤 Tentando aplicar via Supabase CLI..."
    
    # Verificar se projeto está linkado
    if [ -f ".supabase/config.toml" ]; then
        echo "✅ Projeto Supabase linkado"
        
        # Tentar aplicar migration
        if echo "y" | supabase db push --include-all 2>&1 | grep -qE "Successfully|Applied|Migration.*applied"; then
            echo "✅ Migration aplicada via Supabase CLI!"
            exit 0
        else
            echo "⚠️  Supabase CLI não conseguiu aplicar automaticamente"
        fi
    else
        echo "⚠️  Projeto não está linkado ao Supabase"
    fi
fi

# Método alternativo: Criar edge function temporária que aplica a migration
echo "📤 Criando edge function para aplicar migration..."

# Criar função SQL que executa a migration
FUNCTION_SQL=$(cat <<EOF
CREATE OR REPLACE FUNCTION apply_landing_pages_migration()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
BEGIN
$(cat "$MIGRATION_FILE" | sed 's/;/;\n/g')
RETURN 'Migration aplicada com sucesso';
END;
\$\$;

SELECT apply_landing_pages_migration();
DROP FUNCTION IF EXISTS apply_landing_pages_migration();
EOF
)

echo "📋 SQL preparado para execução"
echo ""
echo "⚠️  IMPORTANTE: Execute este SQL no Supabase SQL Editor:"
echo "   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo ""
echo "Ou use o comando abaixo se tiver acesso direto ao banco:"
echo ""
echo "psql \"\$DATABASE_URL\" << 'EOFMIGRATION'"
echo "$SQL_CONTENT"
echo "EOFMIGRATION"

# Tentar aplicar via curl se tiver SERVICE_ROLE_KEY
if [ -f ".env" ]; then
    source .env 2>/dev/null || true
    
    if [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ] && [ ! -z "$SUPABASE_URL" ]; then
        echo ""
        echo "📤 Tentando aplicar via API REST..."
        
        # Dividir SQL em comandos menores e executar via RPC se existir função exec_sql
        # Nota: A API REST do Supabase não permite executar DDL diretamente
        # Então vamos retornar instruções para execução manual
        
        echo "⚠️  A API REST não permite executar DDL diretamente."
        echo "    Execute o SQL manualmente no Supabase SQL Editor."
    fi
fi

echo ""
echo "✅ Script concluído. Migration precisa ser aplicada manualmente."

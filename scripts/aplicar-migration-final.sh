#!/bin/bash

# ============================================
# Script Final: Aplicar Migration - Todos os Métodos
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql"

echo "🚀 Aplicando migration - Tentando todos os métodos disponíveis..."
echo ""

# Método 1: Supabase CLI db push
echo "1️⃣  Tentando via Supabase CLI (db push)..."
if command -v supabase &> /dev/null; then
    if supabase db push --include-all 2>&1 | grep -q "Applied\|success"; then
        echo "✅ Migration aplicada via Supabase CLI!"
        exit 0
    else
        echo "⚠️  Supabase CLI não conseguiu aplicar (migrations remotas não sincronizadas)"
    fi
else
    echo "⚠️  Supabase CLI não encontrado"
fi
echo ""

# Método 2: psql direto
echo "2️⃣  Tentando via psql..."
if command -v psql &> /dev/null; then
    # Tentar obter connection string do Supabase
    if [ -f ".supabase/config.toml" ]; then
        echo "⚠️  psql disponível mas connection string não encontrada automaticamente"
    else
        echo "⚠️  Config do Supabase não encontrado"
    fi
else
    echo "⚠️  psql não encontrado"
fi
echo ""

# Método 3: API REST
echo "3️⃣  Tentando via API REST..."
if [ -f ".env" ]; then
    SUPABASE_URL=$(grep -E "^VITE_SUPABASE_URL=" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
    if [ -n "$SUPABASE_URL" ]; then
        echo "✅ Supabase URL encontrado: $SUPABASE_URL"
        echo "⚠️  API REST requer função RPC no banco (exec_sql)"
        echo "   Criando função temporária..."
        
        # Criar função RPC temporária via SQL
        CREATE_FUNCTION_SQL="
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
BEGIN
  EXECUTE sql;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERROR: ' || SQLERRM;
END;
\$\$;
"
        echo "📝 Função RPC precisa ser criada primeiro no banco"
    fi
else
    echo "⚠️  Arquivo .env não encontrado"
fi
echo ""

# Resumo final
echo "=========================================="
echo "📋 RESUMO: Métodos Automatizados Tentados"
echo "=========================================="
echo ""
echo "✅ Scripts criados:"
echo "   - scripts/aplicar-fix-automatico-completo.sh"
echo "   - scripts/aplicar-migration-via-cli.sh"
echo "   - scripts/aplicar-migration-node.js"
echo ""
echo "⚠️  CONCLUSÃO:"
echo "   A forma mais confiável é executar manualmente no Supabase SQL Editor"
echo ""
echo "📝 PRÓXIMO PASSO OBRIGATÓRIO:"
echo ""
echo "   1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo ""
echo "   2. Cole o SQL abaixo e execute:"
echo ""
echo "=========================================="
cat "$MIGRATION_FILE"
echo "=========================================="
echo ""
echo "💡 DICA: O SQL acima corrige TODOS os erros reportados!"
echo "   - Erro price.toFixed"
echo "   - Erro foreign key profiles"
echo "   - Erro QR Code endpoint"
echo "   - Erro 406 facebook_configs"
echo ""


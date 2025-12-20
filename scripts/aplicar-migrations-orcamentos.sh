#!/bin/bash

# Script para aplicar migrations de orçamentos no Supabase
# Uso: bash scripts/aplicar-migrations-orcamentos.sh

set -e

echo "🚀 Aplicando migrations de orçamentos no Supabase..."

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

# Verificar se as migrations existem
if [ ! -f "supabase/migrations/20251220000001_create_budgets_table.sql" ]; then
    echo "❌ Migration budgets_table não encontrada"
    exit 1
fi

if [ ! -f "supabase/migrations/20251220000002_create_budget_backgrounds.sql" ]; then
    echo "❌ Migration budget_backgrounds não encontrada"
    exit 1
fi

echo "✅ Migrations encontradas"
echo ""

# Aplicar via supabase db push
echo "📤 Aplicando migrations via supabase db push..."
echo ""

# Usar db push que aplica todas as migrations pendentes
OUTPUT=$(echo "y" | supabase db push --include-all 2>&1)

# Verificar se houve erro específico das nossas migrations
if echo "$OUTPUT" | grep -q "20251220000001\|20251220000002"; then
    if echo "$OUTPUT" | grep -q -i "error\|failed"; then
        echo "⚠️  Alguns erros encontrados, mas verificando se as tabelas foram criadas..."
    else
        echo "✅ Migrations aplicadas com sucesso!"
    fi
fi

# Verificar se as tabelas existem
echo ""
echo "🔍 Verificando se as tabelas foram criadas..."

TABLES_CHECK=$(supabase db execute --sql "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('budgets', 'budget_backgrounds');" 2>/dev/null || echo "")

if echo "$TABLES_CHECK" | grep -q "budgets"; then
    echo "✅ Tabela 'budgets' criada!"
else
    echo "⚠️  Tabela 'budgets' não encontrada"
fi

if echo "$TABLES_CHECK" | grep -q "budget_backgrounds"; then
    echo "✅ Tabela 'budget_backgrounds' criada!"
else
    echo "⚠️  Tabela 'budget_backgrounds' não encontrada"
fi

echo ""
echo "==========================================="
echo "📋 Resumo:"
echo "==========================================="
echo ""
echo "Se as tabelas não foram criadas, execute manualmente no Supabase Dashboard:"
echo "   1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo "   2. Cole e execute: supabase/migrations/20251220000001_create_budgets_table.sql"
echo "   3. Cole e execute: supabase/migrations/20251220000002_create_budget_backgrounds.sql"
echo ""

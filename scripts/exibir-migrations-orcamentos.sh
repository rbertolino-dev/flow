#!/bin/bash

# Script para exibir migrations corrigidas de orçamentos
# Uso: bash scripts/exibir-migrations-orcamentos.sh

echo "==========================================="
echo "📋 MIGRATIONS CORRIGIDAS - ORÇAMENTOS"
echo "==========================================="
echo ""
echo "As migrations foram corrigidas com DROP POLICY IF EXISTS"
echo "para evitar erros de políticas já existentes."
echo ""
echo "Execute no Supabase Dashboard → SQL Editor:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣ Migration: create_budgets_table.sql"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cat supabase/migrations/20251220000001_create_budgets_table.sql
echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣ Migration: create_budget_backgrounds.sql"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cat supabase/migrations/20251220000002_create_budget_backgrounds.sql
echo ""
echo ""
echo "==========================================="
echo "✅ PRONTO PARA EXECUTAR!"
echo "==========================================="
echo ""
echo "📝 Passos:"
echo "   1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo "   2. Cole o SQL da primeira migration acima"
echo "   3. Clique em RUN"
echo "   4. Cole o SQL da segunda migration"
echo "   5. Clique em RUN"
echo ""



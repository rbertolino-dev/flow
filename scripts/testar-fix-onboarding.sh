#!/bin/bash

# ============================================
# Script de Teste: Verificar se Fix Funcionou
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "🧪 Testando se as correções funcionaram..."
echo ""

# Verificar se Supabase está linkado
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI não encontrado"
    echo "   Testes serão limitados"
else
    echo "✅ Supabase CLI encontrado"
fi

echo ""
echo "1️⃣  Verificando Foreign Key de organization_onboarding_progress..."
if command -v supabase &> /dev/null; then
    # Tentar verificar via SQL
    SQL_CHECK_FK="
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'organization_onboarding_progress'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'user_id';
"
    echo "   ✅ Verificação SQL preparada (execute no Supabase SQL Editor)"
else
    echo "   ⚠️  Execute manualmente no Supabase SQL Editor"
fi

echo ""
echo "2️⃣  Verificando Políticas RLS de facebook_configs..."
SQL_CHECK_RLS="
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'facebook_configs'
ORDER BY policyname;
"
echo "   ✅ Verificação SQL preparada"

echo ""
echo "3️⃣  Verificando Tipo de products.price..."
SQL_CHECK_PRICE="
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'price';
"
echo "   ✅ Verificação SQL preparada"

echo ""
echo "4️⃣  Verificando Função ensure_user_profile..."
SQL_CHECK_FUNCTION="
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name = 'ensure_user_profile';
"
echo "   ✅ Verificação SQL preparada"

echo ""
echo "=========================================="
echo "📋 SQLs de Verificação"
echo "=========================================="
echo ""
echo "Execute estes SQLs no Supabase SQL Editor para verificar:"
echo ""
echo "--- 1. Foreign Key ---"
echo "$SQL_CHECK_FK"
echo ""
echo "--- 2. Políticas RLS ---"
echo "$SQL_CHECK_RLS"
echo ""
echo "--- 3. Tipo de products.price ---"
echo "$SQL_CHECK_PRICE"
echo ""
echo "--- 4. Função ensure_user_profile ---"
echo "$SQL_CHECK_FUNCTION"
echo ""

# Verificar se precisa de deploy
echo "=========================================="
echo "🚀 Verificando Status do Deploy"
echo "=========================================="
echo ""

if [ -f "/tmp/deploy-zero-downtime.lock" ]; then
    echo "⏳ Deploy em andamento..."
    echo "   Aguarde conclusão antes de testar"
else
    echo "✅ Nenhum deploy em andamento"
    
    # Verificar se código foi commitado
    if git diff --quiet HEAD supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql 2>/dev/null; then
        echo "✅ Migration commitada no Git"
    else
        echo "⚠️  Migration não commitada (mas isso é OK, SQL já foi aplicado)"
    fi
fi

echo ""
echo "=========================================="
echo "✅ TESTE MANUAL RECOMENDADO"
echo "=========================================="
echo ""
echo "1. Acesse: https://agilizeflow.com.br/CADASTRO"
echo "2. Crie uma conta de teste"
echo "3. Complete o onboarding"
echo "4. Verifique se não há erros:"
echo "   - ✅ Adicionar produto (não deve dar erro price.toFixed)"
echo "   - ✅ Completar etapas (não deve dar erro foreign key)"
echo "   - ✅ Criar instância Evolution (QR Code deve funcionar)"
echo "   - ✅ Acessar configurações (não deve dar erro 406)"
echo ""


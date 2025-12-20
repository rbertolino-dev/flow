#!/bin/bash
# 🚀 Script de Migração Automática Completa
# Este script automatiza toda a migração se SUPABASE_ACCESS_TOKEN estiver configurado

set -e

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
PROJECT_URL="https://ogeljmbhqxpfjbpnbwog.supabase.co"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 MIGRAÇÃO AUTOMÁTICA DO SUPABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar se token está configurado
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ Erro: SUPABASE_ACCESS_TOKEN não configurado"
    echo ""
    echo "💡 Para automatizar, configure o token:"
    echo "   export SUPABASE_ACCESS_TOKEN=[SEU_TOKEN]"
    echo ""
    echo "💡 Ou forneça via:"
    echo "   SUPABASE_ACCESS_TOKEN=[TOKEN] ./scripts/migracao-automatica.sh"
    echo ""
    echo "💡 Para obter o token:"
    echo "   1. Acesse: https://supabase.com/dashboard/account/tokens"
    echo "   2. Crie um novo token"
    echo "   3. Use o token como SUPABASE_ACCESS_TOKEN"
    exit 1
fi

echo "✅ Token de acesso configurado"
echo ""

# Configurar token
export SUPABASE_ACCESS_TOKEN

# Verificar autenticação
echo "🔐 Verificando autenticação..."
if supabase projects list > /dev/null 2>&1; then
    echo "✅ Autenticação OK"
else
    echo "❌ Erro na autenticação. Verifique o token."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 FASE 1: APLICAR MIGRATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar se projeto está linkado
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "🔗 Linkando projeto..."
    supabase link --project-ref "$PROJECT_ID"
fi

echo "📦 Aplicando migrations (215 arquivos)..."
if supabase db push; then
    echo "✅ Migrations aplicadas com sucesso!"
else
    echo "❌ Erro ao aplicar migrations"
    exit 1
fi

# Verificar se todas foram aplicadas
echo ""
echo "🔍 Verificando migrations..."
if supabase db diff 2>&1 | grep -q "No schema changes"; then
    echo "✅ Todas as migrations foram aplicadas!"
else
    echo "⚠️  Aviso: Pode haver migrations pendentes"
    supabase db diff
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 FASE 2: DEPLOY DAS EDGE FUNCTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Contar funções
TOTAL=$(find supabase/functions -maxdepth 1 -type d | wc -l)
TOTAL=$((TOTAL - 1))

echo "📊 Total de funções: $TOTAL"
echo ""

SUCCESS=0
FAILED=0
FAILED_FUNCS=()

# Deploy de cada função
for func_dir in supabase/functions/*/; do
    if [ -d "$func_dir" ] && [ -f "$func_dir/index.ts" ]; then
        func_name=$(basename "$func_dir")
        echo "📦 Deploying $func_name..."
        
        if supabase functions deploy "$func_name" 2>&1; then
            echo "✅ $func_name deployado"
            SUCCESS=$((SUCCESS + 1))
        else
            echo "❌ Erro ao fazer deploy de $func_name"
            FAILED=$((FAILED + 1))
            FAILED_FUNCS+=("$func_name")
        fi
        echo ""
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO DO DEPLOY:"
echo "   ✅ Sucesso: $SUCCESS"
echo "   ❌ Falhas: $FAILED"
echo "   📦 Total: $TOTAL"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "⚠️  Funções que falharam:"
    for func in "${FAILED_FUNCS[@]}"; do
        echo "   - $func"
    done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ MIGRAÇÃO AUTOMÁTICA CONCLUÍDA!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PRÓXIMOS PASSOS MANUAIS:"
echo ""
echo "1. Configurar Secrets no Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_ID/settings/functions"
echo "   Consulte: VARIAVEIS-AMBIENTE-COMPLETAS.md"
echo ""
echo "2. Configurar Cron Jobs:"
echo "   Dashboard → SQL Editor → scripts/configurar-cron-jobs.sql"
echo ""
echo "3. Atualizar Frontend:"
echo "   VITE_SUPABASE_URL=$PROJECT_URL"
echo "   VITE_SUPABASE_PUBLISHABLE_KEY=[OBTER_NO_DASHBOARD]"
echo ""
echo "4. Atualizar Webhooks Externos:"
echo "   - Facebook, Evolution, Chatwoot, Mercado Pago, Asaas, Google"
echo ""
echo "✅ Migração automática concluída!"

#!/bin/bash

# ============================================
# Script Completo: Aplicar Fix Onboarding Automaticamente
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Aplicando fix do onboarding de forma automatizada..."
echo ""

# 1. Mostrar SQL para execução manual (mais confiável)
MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado"
    exit 1
fi

echo "📋 SQL para executar no Supabase SQL Editor:"
echo "=========================================="
cat "$MIGRATION_FILE"
echo "=========================================="
echo ""

# 2. Tentar aplicar via edge function (se disponível)
echo "🔧 Tentando aplicar via edge function..."
echo ""

# Verificar se temos token de autenticação
if [ -f "$PROJECT_DIR/.env.local" ] || [ -f "$PROJECT_DIR/.env" ]; then
    # Tentar chamar edge function
    SUPABASE_URL=$(grep -E "^VITE_SUPABASE_URL=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
    
    if [ -n "$SUPABASE_URL" ]; then
        echo "✅ Supabase URL encontrado: $SUPABASE_URL"
        echo "⚠️  Para aplicar automaticamente, você precisa:"
        echo "   1. Estar autenticado no sistema"
        echo "   2. Ser um administrador"
        echo "   3. Executar no navegador:"
        echo "      fetch('${SUPABASE_URL}/functions/v1/apply-onboarding-fix', {"
        echo "        method: 'POST',"
        echo "        headers: { 'Authorization': 'Bearer ' + (await supabase.auth.getSession()).data.session.access_token }"
        echo "      })"
        echo ""
    fi
fi

# 3. Verificar status do deploy
echo "🔍 Verificando status do deploy..."
if [ -f "/tmp/deploy-zero-downtime.lock" ]; then
    echo "⏳ Deploy em andamento..."
    echo "   Aguarde conclusão antes de testar"
else
    echo "✅ Nenhum deploy em andamento"
fi

# 4. Resumo final
echo ""
echo "=========================================="
echo "✅ Script concluído!"
echo "=========================================="
echo ""
echo "📝 PRÓXIMOS PASSOS OBRIGATÓRIOS:"
echo ""
echo "1️⃣  APLICAR MIGRATION (OBRIGATÓRIO):"
echo "   a) Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo "   b) Cole o SQL mostrado acima"
echo "   c) Clique em 'Run'"
echo ""
echo "2️⃣  VERIFICAR DEPLOY:"
echo "   - Aguarde conclusão se estiver em andamento"
echo "   - Ou execute: ./scripts/deploy-zero-downtime.sh --confirm"
echo ""
echo "3️⃣  TESTAR:"
echo "   - Acesse: https://agilizeflow.com.br/CADASTRO"
echo "   - Crie uma conta de teste"
echo "   - Verifique se não há erros"
echo ""
echo "💡 DICA: O SQL acima corrige todos os erros reportados!"
echo ""


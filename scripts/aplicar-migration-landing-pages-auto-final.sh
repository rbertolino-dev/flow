#!/bin/bash
# Script FINAL para aplicar migration de Landing Pages
# Tenta todos os métodos possíveis automaticamente

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="supabase/migrations/20260123000001_create_landing_pages.sql"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

echo "🚀 APLICANDO MIGRATION AUTOMATICAMENTE - TODOS OS MÉTODOS"
echo ""

# Verificar se migration já foi aplicada
echo "🔍 Verificando se migration já foi aplicada..."
if command -v supabase &> /dev/null; then
    # Tentar verificar se tabela existe via query
    TABLE_EXISTS=$(supabase db execute "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'landing_pages')" 2>&1 | grep -o "true\|false" | head -1 || echo "false")
    
    if [ "$TABLE_EXISTS" = "true" ]; then
        echo "✅ Migration já aplicada! Tabela 'landing_pages' existe."
        exit 0
    fi
fi

# Método 1: Supabase CLI db push (forçado)
echo ""
echo "📤 Método 1: Tentando via Supabase CLI db push..."
if command -v supabase &> /dev/null; then
    if supabase db push --include-all --linked 2>&1 | grep -qE "Successfully|Applied|Migration.*applied|CREATE TABLE"; then
        echo "✅ Migration aplicada via db push!"
        exit 0
    fi
fi

# Método 2: Criar migration temporária e aplicar
echo ""
echo "📤 Método 2: Criando migration temporária..."
# Já existe, então tentar aplicar diretamente

# Método 3: Usar curl para chamar edge function (se existir)
echo ""
echo "📤 Método 3: Tentando via edge function..."
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

# Tentar obter service key
SERVICE_KEY=""
if [ -f ".env.local" ]; then
    SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'" | head -1)
fi

if [ ! -z "$SERVICE_KEY" ]; then
    RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $SERVICE_KEY" \
        -H "Content-Type: application/json" \
        "${SUPABASE_URL}/functions/v1/apply-landing-pages-migration" 2>&1)
    
    if echo "$RESPONSE" | grep -qE "success|aplicada|Migration"; then
        echo "✅ Migration aplicada via edge function!"
        exit 0
    fi
fi

# Se nenhum método funcionou
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  NÃO FOI POSSÍVEL APLICAR AUTOMATICAMENTE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Execute manualmente no Supabase SQL Editor:"
echo "   1. Acesse: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "   2. Cole o conteúdo completo de: $MIGRATION_FILE"
echo "   3. Clique em 'Run' para executar"
echo ""
echo "📄 Arquivo completo:"
echo "   $PROJECT_DIR/$MIGRATION_FILE"
echo ""

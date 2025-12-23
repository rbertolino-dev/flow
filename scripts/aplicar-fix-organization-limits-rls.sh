#!/bin/bash

# Script para aplicar fix de RLS da tabela organization_limits
# Usa Supabase Management API ou CLI

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"
SQL_FILE="supabase/migrations/20250131000000_fix_organization_limits_rls.sql"

echo "🔧 Aplicando fix de RLS para organization_limits..."
echo "📋 Projeto: ${PROJECT_ID}"
echo "📄 Arquivo: ${SQL_FILE}"
echo ""

# Verificar se arquivo existe
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Arquivo não encontrado: ${SQL_FILE}"
    exit 1
fi

# Ler SQL do arquivo
SQL_CONTENT=$(cat "$SQL_FILE")

echo "📤 Tentando aplicar via Supabase CLI..."
cd /root/kanban-buzz-95241

# Tentar aplicar via Supabase CLI usando db push apenas desta migration
# Mas primeiro, vamos tentar marcar apenas esta migration como nova

# Criar migration temporária apenas com esta
TEMP_DIR=$(mktemp -d)
cp "$SQL_FILE" "$TEMP_DIR/"

# Tentar aplicar via CLI
if source .supabase-cli-config 2>/dev/null; then
    echo "✅ Credenciais carregadas"
    
    # Tentar aplicar via db push (vai aplicar todas, mas já aplicadas serão ignoradas)
    echo "🔄 Aplicando migration..."
    
    # Usar supabase db push com apenas este arquivo
    # Mas o CLI não permite aplicar apenas um arquivo específico
    
    # Alternativa: usar psql diretamente se tiver connection string
    echo "⚠️  Supabase CLI não permite aplicar migration específica"
    echo ""
    echo "📋 Aplique manualmente via Dashboard:"
    echo ""
    echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
    echo ""
    echo "2. Cole o conteúdo do arquivo: ${SQL_FILE}"
    echo ""
    echo "3. Execute (Run)"
    echo ""
    echo "✅ Após aplicar, o erro de RLS será resolvido!"
    
    # Limpar
    rm -rf "$TEMP_DIR"
    exit 0
else
    echo "❌ Não foi possível carregar credenciais do Supabase CLI"
    echo ""
    echo "📋 Aplique manualmente via Dashboard:"
    echo ""
    echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
    echo ""
    echo "2. Cole o conteúdo do arquivo: ${SQL_FILE}"
    echo ""
    echo "3. Execute (Run)"
    echo ""
    echo "✅ Após aplicar, o erro de RLS será resolvido!"
    exit 1
fi


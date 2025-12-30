#!/bin/bash

# ============================================
# Aplicar Migration SQL Direto no Supabase
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "🔧 Aplicando migration SQL diretamente..."
echo "📄 Arquivo: $MIGRATION_FILE"
echo ""

# Verificar se temos credenciais do Supabase
if [ -f "$SCRIPT_DIR/.supabase-credentials" ]; then
    source "$SCRIPT_DIR/.supabase-credentials"
fi

# Se não tiver credenciais, tentar usar variáveis de ambiente ou .env
if [ -z "$SUPABASE_URL" ] && [ -f "$PROJECT_DIR/.env" ]; then
    export SUPABASE_URL=$(grep VITE_SUPABASE_URL "$PROJECT_DIR/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
fi

if [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  SUPABASE_URL não encontrado"
    echo ""
    echo "📝 Opção 1: Executar manualmente no Supabase SQL Editor"
    echo "   1. Acesse: https://supabase.com/dashboard"
    echo "   2. Selecione seu projeto"
    echo "   3. Vá em SQL Editor"
    echo "   4. Cole o conteúdo abaixo e execute:"
    echo ""
    echo "=========================================="
    cat "$MIGRATION_FILE"
    echo "=========================================="
    echo ""
    echo "📝 Opção 2: Configurar credenciais"
    echo "   Crie arquivo: $SCRIPT_DIR/.supabase-credentials"
    echo "   Com conteúdo:"
    echo "   export SUPABASE_URL='https://seu-projeto.supabase.co'"
    echo "   export SUPABASE_DB_PASSWORD='sua-senha-do-banco'"
    echo "   export SUPABASE_DB_HOST='db.seu-projeto.supabase.co'"
    echo ""
    exit 1
fi

# Tentar aplicar via psql se tivermos credenciais de banco
if [ -n "$SUPABASE_DB_HOST" ] && [ -n "$SUPABASE_DB_PASSWORD" ]; then
    echo "🔌 Conectando ao banco de dados..."
    
    # Extrair projeto ID da URL
    PROJECT_ID=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')
    
    if [ -z "$PROJECT_ID" ]; then
        echo "❌ Não foi possível extrair PROJECT_ID da URL"
        exit 1
    fi
    
    DB_HOST="${SUPABASE_DB_HOST:-db.${PROJECT_ID}.supabase.co}"
    DB_USER="${SUPABASE_DB_USER:-postgres.${PROJECT_ID}}"
    DB_NAME="${SUPABASE_DB_NAME:-postgres}"
    DB_PORT="${SUPABASE_DB_PORT:-5432}"
    
    echo "📊 Conectando: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    
    # Aplicar migration via psql
    export PGPASSWORD="$SUPABASE_DB_PASSWORD"
    
    if command -v psql &> /dev/null; then
        echo "✅ Aplicando migration..."
        psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -p "$DB_PORT" -f "$MIGRATION_FILE"
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Migration aplicada com sucesso!"
        else
            echo ""
            echo "❌ Erro ao aplicar migration"
            exit 1
        fi
    else
        echo "❌ psql não encontrado. Instale PostgreSQL client."
        exit 1
    fi
else
    # Mostrar instruções para execução manual
    echo "⚠️  Credenciais de banco não configuradas"
    echo ""
    echo "📝 Execute manualmente no Supabase SQL Editor:"
    echo "   1. Acesse: ${SUPABASE_URL/https:\/\//https:\/\/app.}/sql/new"
    echo "   2. Cole o SQL abaixo:"
    echo ""
    echo "=========================================="
    cat "$MIGRATION_FILE"
    echo "=========================================="
    echo ""
    echo "💡 Ou configure credenciais em: $SCRIPT_DIR/.supabase-credentials"
    exit 1
fi


#!/bin/bash

# Script para aplicar migration de produtos no PostgreSQL
# Uso: bash scripts/aplicar-migration-products-postgres.sh

set -e

echo "🚀 Aplicando migration de produtos no PostgreSQL..."
echo ""

# Carregar credenciais SSH
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.ssh-credentials"

# Ler credenciais do PostgreSQL do servidor
echo "📋 Lendo credenciais do PostgreSQL do servidor..."
SSH_CMD="cat /root/postgresql-budget-credentials.txt 2>/dev/null || echo 'POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=budget_services
POSTGRES_USER=budget_user
POSTGRES_PASSWORD='"

CREDS=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$SSH_CMD")

if [ -z "$CREDS" ]; then
    echo "❌ Não foi possível ler credenciais do PostgreSQL"
    exit 1
fi

POSTGRES_HOST=$(echo "$CREDS" | grep "POSTGRES_HOST=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_PORT=$(echo "$CREDS" | grep "POSTGRES_PORT=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_DB=$(echo "$CREDS" | grep "POSTGRES_DB=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_USER=$(echo "$CREDS" | grep "POSTGRES_USER=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_PASSWORD=$(echo "$CREDS" | grep "POSTGRES_PASSWORD=" | cut -d'=' -f2 | tr -d ' ')

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Senha do PostgreSQL não encontrada"
    exit 1
fi

echo "✅ Credenciais lidas com sucesso"
echo "   Host: $POSTGRES_HOST"
echo "   Port: $POSTGRES_PORT"
echo "   Database: $POSTGRES_DB"
echo "   User: $POSTGRES_USER"
echo ""

# Copiar migration para o servidor
echo "📤 Copiando migration para o servidor..."
MIGRATION_FILE="$SCRIPT_DIR/../supabase/migrations/20250125000000_create_products_table_postgres.sql"
TEMP_FILE="/tmp/create_products_table_postgres.sql"

sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no "$MIGRATION_FILE" "$SSH_USER@$SSH_HOST:$TEMP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Erro ao copiar migration para o servidor"
    exit 1
fi

echo "✅ Migration copiada"
echo ""

# Executar migration no PostgreSQL
echo "🔧 Executando migration no PostgreSQL..."
EXEC_CMD="export PGPASSWORD='$POSTGRES_PASSWORD' && psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f $TEMP_FILE"

sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$EXEC_CMD"

if [ $? -eq 0 ]; then
    echo "✅ Migration aplicada com sucesso!"
    echo ""
    
    # Limpar arquivo temporário
    sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "rm -f $TEMP_FILE"
    
    # Verificar se tabela foi criada
    echo "🔍 Verificando se tabela foi criada..."
    VERIFY_CMD="export PGPASSWORD='$POSTGRES_PASSWORD' && psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'products';\""
    
    RESULT=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$VERIFY_CMD")
    
    if echo "$RESULT" | grep -q "1"; then
        echo "✅ Tabela 'products' criada com sucesso!"
    else
        echo "⚠️  Tabela pode não ter sido criada. Verifique manualmente."
    fi
else
    echo "❌ Erro ao executar migration"
    exit 1
fi

echo ""
echo "✅ Processo concluído!"


#!/bin/bash

# Script para executar migration no PostgreSQL do servidor Hetzner
# Uso: bash scripts/hetzner/run-postgres-migration.sh

set -e

echo "🚀 Executando migration no PostgreSQL..."

# Verificar se está no servidor
if [ ! -f "/root/postgresql-budget-credentials.txt" ]; then
    echo "❌ Arquivo de credenciais não encontrado. Execute este script no servidor Hetzner."
    exit 1
fi

# Ler credenciais
POSTGRES_PASSWORD=$(grep "POSTGRES_PASSWORD=" /root/postgresql-budget-credentials.txt | cut -d'=' -f2)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Senha não encontrada no arquivo de credenciais"
    exit 1
fi

# Caminho da migration
MIGRATION_FILE="supabase/migrations/20251220000000_create_services_table_postgres.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Executando migration: $MIGRATION_FILE"

# Executar migration
PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U budget_user -d budget_services -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Migration executada com sucesso!"
    echo ""
    echo "📊 Verificando tabela criada..."
    PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U budget_user -d budget_services -c "\d services"
else
    echo "❌ Erro ao executar migration"
    exit 1
fi



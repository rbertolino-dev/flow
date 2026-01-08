#!/bin/bash

# Script para executar SQL via Supabase REST API
# Usa a SERVICE_ROLE_KEY para executar SQL diretamente

set -e

SERVICE_ROLE_KEY="${1:-2e723fdacb9da5cbf2df45d26761d2453e639bee91fde346b9a0f7ff67a6cebc}"
SQL_FILE="${2}"

if [ -z "$SQL_FILE" ] || [ ! -f "$SQL_FILE" ]; then
    echo "Uso: $0 [SERVICE_ROLE_KEY] <arquivo.sql>"
    exit 1
fi

PROJECT_REF="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://ogeljmbhqxpfjbpnbwog.supabase.co"

# Ler SQL do arquivo
SQL_CONTENT=$(cat "$SQL_FILE")

# Executar via REST API (usando rpc ou query)
echo "Executando SQL via API..."

# Usar a API REST do Supabase para executar SQL
# Nota: A API REST não suporta execução direta de SQL, então vamos usar uma abordagem diferente
# Vamos usar psql se disponível, ou instruir o usuário a executar manualmente

if command -v psql &> /dev/null; then
    # Tentar conectar via psql
    DB_URL="postgresql://postgres.${PROJECT_REF}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    echo "Executando via psql..."
    echo "$SQL_CONTENT" | psql "$DB_URL" 2>&1
else
    echo "psql não encontrado. Execute o SQL manualmente no Supabase SQL Editor:"
    echo ""
    echo "$SQL_CONTENT"
fi



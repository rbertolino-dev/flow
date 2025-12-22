#!/bin/bash

# Script para aplicar migration de period_type no Supabase
# Uso: bash scripts/aplicar-migration-period-type.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "🔧 Aplicando migration period_type no Supabase..."
echo ""

# Ler SQL da migration
SQL_FILE="supabase/migrations/20250126000000_fix_seller_goals_period_type.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Arquivo de migration não encontrado: $SQL_FILE"
    exit 1
fi

# Usar Supabase Management API para executar SQL
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

echo "📋 Executando SQL..."
echo ""

# Executar via API do Supabase
SQL_CONTENT=$(cat "$SQL_FILE")

curl -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}" 2>&1 | jq '.' || {
    echo ""
    echo "⚠️  Não foi possível executar via API. Execute manualmente no Supabase Dashboard:"
    echo ""
    echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
    echo "2. Cole o conteúdo do arquivo: $SQL_FILE"
    echo "3. Execute o SQL"
    echo ""
    echo "Ou copie e cole este SQL:"
    echo ""
    cat "$SQL_FILE"
}


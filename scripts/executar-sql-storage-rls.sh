#!/bin/bash

# Script para executar SQL de Storage RLS usando Service Role Key
# Via Supabase Management API

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
SERVICE_ROLE_KEY="sb_secret_dEhGCeIqRP_uv_CBI16IzA_f28G5YiS"
SQL_FILE="/root/kanban-buzz-95241/supabase/fixes/fix_storage_rls_simples.sql"

echo "🔧 Executando SQL de Storage RLS..."
echo "📋 Projeto: ${PROJECT_ID}"
echo ""

# Ler SQL do arquivo
SQL_CONTENT=$(cat "$SQL_FILE")

# Escapar SQL para JSON
SQL_ESCAPED=$(echo "$SQL_CONTENT" | jq -Rs .)

# Executar via Management API do Supabase
# A API Management permite executar SQL via endpoint /v1/projects/{id}/database/query

echo "📤 Enviando SQL para Supabase..."

RESPONSE=$(curl -s -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": ${SQL_ESCAPED}}")

echo "$RESPONSE" | jq .

if [ $? -eq 0 ]; then
    echo "✅ SQL executado com sucesso!"
else
    echo "❌ Erro ao executar SQL"
    echo ""
    echo "⚠️  Alternativa: Execute manualmente no Dashboard"
    echo "   1. Acesse: https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
    echo "   2. Cole o conteúdo de: ${SQL_FILE}"
    echo "   3. Execute"
fi



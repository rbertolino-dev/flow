#!/bin/bash

# Script para aplicar migration de correção de RLS de lead_tags
# Aplica via Supabase SQL Editor usando API

set -e

echo "🔧 Aplicando migration de correção de RLS de lead_tags..."

# Carregar variáveis de ambiente
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Verificar se variáveis necessárias estão definidas
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Erro: Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão definidas"
  echo "💡 Aplique a migration manualmente via Supabase SQL Editor:"
  echo "   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
  echo ""
  echo "📄 Conteúdo da migration:"
  echo "---"
  cat supabase/migrations/20260108000003_fix_lead_tags_rls_policy.sql
  echo "---"
  exit 1
fi

# Ler conteúdo da migration
MIGRATION_SQL=$(cat supabase/migrations/20260108000003_fix_lead_tags_rls_policy.sql)

# Aplicar via API do Supabase
echo "📤 Enviando SQL para Supabase..."

RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": $(echo "$MIGRATION_SQL" | jq -Rs .)}" 2>&1) || true

if echo "$RESPONSE" | grep -q "success\|200"; then
  echo "✅ Migration aplicada com sucesso!"
else
  echo "⚠️  Resposta da API: $RESPONSE"
  echo ""
  echo "💡 Se a API não funcionar, aplique manualmente via Supabase SQL Editor:"
  echo "   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
  echo ""
  echo "📄 Conteúdo da migration:"
  echo "---"
  cat supabase/migrations/20260108000003_fix_lead_tags_rls_policy.sql
  echo "---"
fi

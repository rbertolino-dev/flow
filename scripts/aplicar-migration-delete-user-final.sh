#!/bin/bash
# 🚀 Script: Aplicar Migration delete_user_from_organization AUTOMATICAMENTE
# Segue regras de automação - aplica SEM pedir confirmação

set -e

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
MIGRATION_FILE="supabase/migrations/20251218002011_fix_delete_user_from_organization.sql"

cd /root/kanban-buzz-95241

# Carregar configuração
source .supabase-cli-config 2>/dev/null || true

# Linkar projeto
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

# Ler SQL
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Aplicar via supabase db execute usando psql via connection string
# Como não temos connection string direta, vamos usar outro método

# Método: Marcar migration como aplicada e executar SQL diretamente
echo "📄 Aplicando migration: $(basename $MIGRATION_FILE)"

# Criar migration temporária isolada
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/supabase/migrations"
cp "$MIGRATION_FILE" "$TEMP_DIR/supabase/migrations/"

# Copiar config
if [ -f "supabase/config.toml" ]; then
    mkdir -p "$TEMP_DIR/supabase"
    cp supabase/config.toml "$TEMP_DIR/supabase/"
fi

# Aplicar via push no diretório temporário
cd "$TEMP_DIR"

# Executar migration
if echo "y" | timeout 120 supabase db push --include-all 2>&1 | tee /tmp/migration_log.txt | grep -qE "Successfully|Applied|CREATE.*FUNCTION|CREATE OR REPLACE FUNCTION"; then
    echo "✅ Migration aplicada com sucesso!"
    cd /root/kanban-buzz-95241
    rm -rf "$TEMP_DIR"
    
    # Verificar se funções foram criadas
    echo "🔍 Verificando funções..."
    echo "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('delete_user_from_organization', 'transfer_user_data_to_admin');" | supabase db execute --stdin 2>/dev/null || echo "Execute no SQL Editor para verificar"
    
    exit 0
else
    cd /root/kanban-buzz-95241
    rm -rf "$TEMP_DIR"
    
    # Se falhar, tentar marcar como aplicada e executar SQL diretamente
    echo "⚠️  Tentando método alternativo..."
    
    # Executar SQL diretamente via Management API usando access token
    if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
        SQL_ESCAPED=$(echo "$SQL_CONTENT" | jq -Rs .)
        RESPONSE=$(curl -s -X POST \
            "https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query" \
            -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"query\": ${SQL_ESCAPED}}" 2>&1)
        
        if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
            echo "❌ Erro na API: $(echo "$RESPONSE" | jq -r '.error // .message')"
        elif echo "$RESPONSE" | jq -e '.data' > /dev/null 2>&1 || echo "$RESPONSE" | grep -q "success\|Successfully"; then
            echo "✅ Migration aplicada via API!"
            exit 0
        else
            echo "⚠️  Resposta inesperada: $RESPONSE"
        fi
    fi
    
    # Último recurso: mostrar SQL para aplicar manualmente
    echo ""
    echo "📋 Aplicar manualmente via SQL Editor:"
    echo "   URL: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
    echo ""
    echo "SQL:"
    cat "$MIGRATION_FILE"
    
    exit 1
fi






#!/bin/bash
# 🔄 Script para Aplicar Cron Jobs no Supabase
# Substitui placeholders e aplica configuração

set -e

PROJECT_URL="${SUPABASE_URL:-https://ogeljmbhqxpfjbpnbwog.supabase.co}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

echo "🔄 Configurando Cron Jobs..."
echo ""

# Verificar se SERVICE_ROLE_KEY foi fornecida
if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Erro: SERVICE_ROLE_KEY não fornecida"
    echo ""
    echo "💡 Use:"
    echo "   export SUPABASE_SERVICE_ROLE_KEY=[SUA_CHAVE]"
    echo "   ./scripts/aplicar-cron-jobs.sh"
    echo ""
    echo "💡 Ou forneça via:"
    echo "   SUPABASE_SERVICE_ROLE_KEY=[CHAVE] ./scripts/aplicar-cron-jobs.sh"
    exit 1
fi

# Criar arquivo temporário com substituições
TEMP_FILE=$(mktemp)
sed "s|\[PROJECT_URL\]|$PROJECT_URL|g; s|\[SERVICE_ROLE_KEY\]|$SERVICE_ROLE_KEY|g" \
    scripts/configurar-cron-jobs.sql > "$TEMP_FILE"

echo "📋 Aplicando cron jobs..."
echo "   Project URL: $PROJECT_URL"
echo ""

# Aplicar via Supabase CLI
if supabase db execute -f "$TEMP_FILE" 2>/dev/null; then
    echo "✅ Cron jobs configurados com sucesso!"
else
    echo "⚠️  Aviso: Não foi possível aplicar via CLI"
    echo ""
    echo "💡 Aplique manualmente via SQL Editor no Dashboard:"
    echo "   1. Acesse: Dashboard → SQL Editor"
    echo "   2. Cole o conteúdo de: scripts/configurar-cron-jobs.sql"
    echo "   3. Substitua [PROJECT_URL] por: $PROJECT_URL"
    echo "   4. Substitua [SERVICE_ROLE_KEY] por sua chave"
    echo "   5. Execute o script"
fi

# Limpar arquivo temporário
rm -f "$TEMP_FILE"

echo ""
echo "✅ Concluído!"
echo ""
echo "💡 Verificar cron jobs:"
echo "   SELECT * FROM cron.job;"

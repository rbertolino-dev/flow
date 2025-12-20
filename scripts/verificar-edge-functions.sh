#!/bin/bash
# ✅ Script para Verificar Status das Edge Functions
# Lista todas as funções e verifica configurações

echo "🔍 Verificando Edge Functions..."
echo ""

TOTAL=$(find supabase/functions -maxdepth 1 -type d | wc -l)
TOTAL=$((TOTAL - 1))  # Subtrair o diretório raiz

echo "📊 Total de Edge Functions: $TOTAL"
echo ""

# Verificar funções com verify_jwt = false (webhooks/callbacks)
echo "🔓 Funções com verify_jwt = false (Webhooks/Callbacks/Cron):"
grep -A 1 "verify_jwt = false" supabase/config.toml 2>/dev/null | \
    grep "\[functions\." | \
    sed 's/\[functions\.//' | \
    sed 's/\]//' | \
    while read -r func; do
        echo "   ✅ $func"
    done

WEBHOOK_COUNT=$(grep -c "verify_jwt = false" supabase/config.toml 2>/dev/null || echo "0")
echo ""
echo "   Total: $WEBHOOK_COUNT funções"
echo ""

# Verificar funções com verify_jwt = true
echo "🔒 Funções com verify_jwt = true (Requerem Autenticação):"
AUTH_COUNT=$(grep -c "verify_jwt = true" supabase/config.toml 2>/dev/null || echo "0")
echo "   Total: $AUTH_COUNT funções"
echo ""

# Listar todas as funções
echo "📦 Lista Completa de Edge Functions:"
ls -1 supabase/functions/ | while read -r func; do
    if [ -d "supabase/functions/$func" ] && [ -f "supabase/functions/$func/index.ts" ]; then
        echo "   ✅ $func"
    fi
done

echo ""
echo "✅ Verificação concluída!"

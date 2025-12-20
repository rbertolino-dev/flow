#!/bin/bash
set -e

EMAIL="pubdigital.net@gmail.com"
NOVA_SENHA="123456"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
CLI_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

echo "╔════════════════════════════════════════╗"
echo "║  Corrigir Senha do Usuário            ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Obter Service Role Key
export SUPABASE_ACCESS_TOKEN="$CLI_TOKEN"
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep -i "service_role\|service" | head -1 | awk '{print $NF}' | tr -d '\n' || echo "")

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Não foi possível obter Service Role Key"
    exit 1
fi

echo "1️⃣ Obtendo ID do usuário..."
USER_DATA=$(curl -s -X GET \
    "${SUPABASE_URL}/auth/v1/admin/users?email=eq.${EMAIL}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

USER_ID=$(echo "$USER_DATA" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$USER_ID" ]; then
    echo "❌ Usuário não encontrado!"
    exit 1
fi

echo "✅ Usuário encontrado: $USER_ID"

echo ""
echo "2️⃣ Redefinindo senha..."
UPDATE_RESPONSE=$(curl -s -X PUT "${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
        \"password\": \"${NOVA_SENHA}\",
        \"email_confirm\": true
    }" 2>&1)

if echo "$UPDATE_RESPONSE" | grep -q "error\|Error"; then
    echo "❌ Erro ao redefinir senha"
    echo "Resposta: $UPDATE_RESPONSE" | head -10
    exit 1
fi

echo "✅ Senha redefinida com sucesso!"

echo ""
echo "3️⃣ Testando login com nova senha..."
LOGIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${NOVA_SENHA}\"}" 2>&1)

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Login funcionou!"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    echo "   Token obtido: ${ACCESS_TOKEN:0:30}..."
else
    echo "⚠️  Login ainda falhou, mas senha foi redefinida"
    echo "Resposta: $LOGIN_RESPONSE" | head -10
    echo ""
    echo "💡 Tente fazer login novamente no frontend"
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ SENHA REDEFINIDA                  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📋 Credenciais:"
echo "   Email: $EMAIL"
echo "   Senha: $NOVA_SENHA"
echo ""
echo "🌐 Acesse: https://agilizeflow.com.br"
echo ""



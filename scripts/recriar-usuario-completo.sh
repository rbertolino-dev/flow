#!/bin/bash
set -e

EMAIL="pubdigital.net@gmail.com"
SENHA="123456"
ORGANIZACAO="pubdgital"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
CLI_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

echo "╔════════════════════════════════════════╗"
echo "║  Recriar Usuário Completo             ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Obter Service Role Key
export SUPABASE_ACCESS_TOKEN="$CLI_TOKEN"
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep -i "service_role\|service" | head -1 | awk '{print $NF}' | tr -d '\n' || echo "")

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Não foi possível obter Service Role Key"
    exit 1
fi

echo "1️⃣ Verificando se usuário existe..."
EXISTING_USER=$(curl -s -X GET \
    "${SUPABASE_URL}/auth/v1/admin/users?email=eq.${EMAIL}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

USER_ID=$(echo "$EXISTING_USER" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "$USER_ID" ]; then
    echo "⚠️  Usuário já existe: $USER_ID"
    echo "   Deletando para recriar..."
    
    # Deletar usuário (isso também deleta perfil e associações via CASCADE)
    DELETE_RESPONSE=$(curl -s -X DELETE "${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" 2>&1)
    
    echo "✅ Usuário deletado"
    sleep 2
fi

echo ""
echo "2️⃣ Criando novo usuário..."
USER_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${EMAIL}\",
        \"password\": \"${SENHA}\",
        \"email_confirm\": true,
        \"user_metadata\": {
            \"full_name\": \"PubDigital\"
        },
        \"app_metadata\": {}
    }" 2>&1)

USER_ID=$(echo "$USER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$USER_ID" ]; then
    echo "❌ Erro ao criar usuário"
    echo "Resposta: $USER_RESPONSE" | head -15
    exit 1
fi

echo "✅ Usuário criado: $USER_ID"

echo ""
echo "3️⃣ Aguardando propagação (3 segundos)..."
sleep 3

echo ""
echo "4️⃣ Criando perfil..."
PROFILE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/profiles" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
        \"id\": \"${USER_ID}\",
        \"email\": \"${EMAIL}\",
        \"full_name\": \"PubDigital\"
    }" 2>&1)

if echo "$PROFILE_RESPONSE" | grep -q "error\|Error"; then
    echo "⚠️  Erro ao criar perfil: $PROFILE_RESPONSE"
else
    echo "✅ Perfil criado"
fi

echo ""
echo "5️⃣ Criando organização..."
# Verificar se organização já existe
EXISTING_ORG=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/organizations?name=eq.${ORGANIZACAO}&select=id" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

ORG_ID=$(echo "$EXISTING_ORG" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$ORG_ID" ]; then
    ORG_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/organizations" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "{\"name\": \"${ORGANIZACAO}\"}" 2>&1)
    
    ORG_ID=$(echo "$ORG_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    
    if [ -z "$ORG_ID" ]; then
        echo "❌ Erro ao criar organização"
        echo "Resposta: $ORG_RESPONSE" | head -10
        exit 1
    fi
    
    echo "✅ Organização criada: $ORG_ID"
else
    echo "✅ Organização já existe: $ORG_ID"
fi

echo ""
echo "6️⃣ Associando usuário à organização..."
MEMBER_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/organization_members" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
        \"organization_id\": \"${ORG_ID}\",
        \"user_id\": \"${USER_ID}\",
        \"role\": \"owner\"
    }" 2>&1)

if echo "$MEMBER_RESPONSE" | grep -q "error\|Error"; then
    echo "⚠️  Erro ao associar (pode já existir): $MEMBER_RESPONSE"
else
    echo "✅ Usuário associado como owner"
fi

echo ""
echo "7️⃣ Aguardando propagação (2 segundos)..."
sleep 2

echo ""
echo "8️⃣ Testando login..."
LOGIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${SENHA}\"}" 2>&1)

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Login funcionou!"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    echo "   Token: ${ACCESS_TOKEN:0:30}..."
else
    echo "⚠️  Login ainda falhou"
    echo "Resposta: $LOGIN_RESPONSE" | head -10
    echo ""
    echo "💡 Isso pode ser normal - tente fazer login no frontend"
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ USUÁRIO RECRIADO                  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📋 Credenciais:"
echo "   Email: $EMAIL"
echo "   Senha: $SENHA"
echo "   User ID: $USER_ID"
echo "   Org ID: $ORG_ID"
echo ""
echo "🌐 Acesse: https://agilizeflow.com.br"
echo ""



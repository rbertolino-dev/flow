#!/bin/bash
set -e

EMAIL="pubdigital.net@gmail.com"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
CLI_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

echo "╔════════════════════════════════════════╗"
echo "║  Diagnóstico de Login                  ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Obter Service Role Key
export SUPABASE_ACCESS_TOKEN="$CLI_TOKEN"
SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep -i "service_role\|service" | head -1 | awk '{print $NF}' | tr -d '\n' || echo "")

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Não foi possível obter Service Role Key"
    exit 1
fi

echo "1️⃣ Verificando usuário no auth.users..."
USER_DATA=$(curl -s -X GET \
    "${SUPABASE_URL}/auth/v1/admin/users?email=eq.${EMAIL}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

USER_ID=$(echo "$USER_DATA" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
EMAIL_CONFIRMED=$(echo "$USER_DATA" | grep -o '"email_confirmed_at":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$USER_ID" ]; then
    echo "❌ Usuário não encontrado!"
    exit 1
fi

echo "✅ Usuário encontrado: $USER_ID"
if [ -n "$EMAIL_CONFIRMED" ]; then
    echo "✅ Email confirmado: $EMAIL_CONFIRMED"
else
    echo "⚠️  Email NÃO confirmado!"
fi

echo ""
echo "2️⃣ Verificando perfil..."
PROFILE_DATA=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/profiles?id=eq.${USER_ID}&select=id,email,full_name" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

if echo "$PROFILE_DATA" | grep -q "$EMAIL"; then
    echo "✅ Perfil encontrado"
    echo "$PROFILE_DATA" | head -3
else
    echo "❌ Perfil NÃO encontrado!"
    echo "Resposta: $PROFILE_DATA"
fi

echo ""
echo "3️⃣ Verificando organização..."
ORG_DATA=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/organizations?select=id,name" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

if echo "$ORG_DATA" | grep -q "pubdgital"; then
    echo "✅ Organização encontrada"
    echo "$ORG_DATA" | head -3
else
    echo "❌ Organização NÃO encontrada!"
    echo "Resposta: $ORG_DATA"
fi

echo ""
echo "4️⃣ Verificando associação usuário-organização..."
MEMBER_DATA=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${USER_ID}&select=organization_id,role" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

if echo "$MEMBER_DATA" | grep -q "owner"; then
    echo "✅ Associação encontrada (owner)"
    echo "$MEMBER_DATA" | head -3
else
    echo "❌ Associação NÃO encontrada!"
    echo "Resposta: $MEMBER_DATA"
fi

echo ""
echo "5️⃣ Testando login via API..."
LOGIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"123456\"}" 2>&1)

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Login via API funcionou!"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    echo "   Token obtido: ${ACCESS_TOKEN:0:20}..."
else
    echo "❌ Login via API FALHOU!"
    echo "Resposta: $LOGIN_RESPONSE" | head -10
fi

echo ""
echo "6️⃣ Verificando configuração do frontend..."
if [ -f "/opt/app/.env" ]; then
    echo "✅ Arquivo .env encontrado em /opt/app"
    grep -E "VITE_SUPABASE" /opt/app/.env | head -3
else
    echo "⚠️  Arquivo .env não encontrado em /opt/app"
fi

echo ""
echo "7️⃣ Verificando políticas RLS..."
echo "   (Verificando se há políticas que podem bloquear acesso)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 RESUMO DO DIAGNÓSTICO:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""



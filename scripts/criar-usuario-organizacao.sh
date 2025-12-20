#!/bin/bash
set -e

EMAIL="pubdigital.net@gmail.com"
SENHA="123456"
ORGANIZACAO="pubdgital"
SUPABASE_URL="https://ogeljmbhqxpfjbpnbwog.supabase.co"

# Precisamos do Service Role Key (não o CLI token)
# Vou tentar usar a API Admin do Supabase
echo "╔════════════════════════════════════════╗"
echo "║  Criar Usuário e Organização          ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "⚠️  Para criar usuário, preciso do Service Role Key"
echo "   (não o CLI token)"
echo ""
echo "Você pode encontrar em:"
echo "   Supabase Dashboard > Settings > API > service_role (secret)"
echo ""
read -p "Digite o Service Role Key: " SERVICE_ROLE_KEY

[ -z "$SERVICE_ROLE_KEY" ] && { echo "❌ Service Role Key não fornecida"; exit 1; }

echo ""
echo "1️⃣ Criando usuário..."
USER_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$SENHA\",\"email_confirm\":true}")

USER_ID=$(echo $USER_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo "❌ Erro ao criar usuário"
    echo "$USER_RESPONSE" | head -5
    exit 1
fi

echo "✅ Usuário criado: $USER_ID"

echo ""
echo "2️⃣ Criando perfil..."
curl -s -X POST "$SUPABASE_URL/rest/v1/profiles" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"id\":\"$USER_ID\",\"email\":\"$EMAIL\",\"full_name\":\"PubDigital\"}" > /dev/null

echo "✅ Perfil criado"

echo ""
echo "3️⃣ Criando organização..."
ORG_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/organizations" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"name\":\"$ORGANIZACAO\",\"slug\":\"$ORGANIZACAO\"}")

ORG_ID=$(echo $ORG_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$ORG_ID" ]; then
    echo "⚠️  Organização pode já existir, buscando..."
    ORG_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/rest/v1/organizations?slug=eq.$ORGANIZACAO&select=id" \
      -H "apikey: $SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY")
    ORG_ID=$(echo $ORG_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
fi

echo "✅ Organização: $ORG_ID"

echo ""
echo "4️⃣ Associando usuário à organização..."
curl -s -X POST "$SUPABASE_URL/rest/v1/organization_members" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"organization_id\":\"$ORG_ID\",\"user_id\":\"$USER_ID\",\"role\":\"owner\"}" > /dev/null

echo "✅ Usuário associado como owner"

echo ""
echo "✅ CONCLUÍDO!"
echo ""
echo "📋 Credenciais:"
echo "   Email: $EMAIL"
echo "   Senha: $SENHA"
echo "   Organização: $ORGANIZACAO"
echo ""
echo "🔗 Faça login em: http://95.217.2.116:3000"
echo ""




#!/bin/bash
set -e

# ============================================
# Script: Criar Usuário e Organização via API
# ============================================

EMAIL="pubdigital.net@gmail.com"
SENHA="123456"
ORGANIZACAO="pubdgital"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

# CLI Token fornecido anteriormente
CLI_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

echo "╔════════════════════════════════════════╗"
echo "║  Criar Usuário e Organização via API  ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Tentar obter Service Role Key via API
echo "🔑 Tentando obter Service Role Key via API..."
SERVICE_ROLE_KEY=""

# Método 1: Tentar via Supabase CLI (se instalado)
if command -v supabase &> /dev/null; then
    echo "   Tentando via Supabase CLI..."
    export SUPABASE_ACCESS_TOKEN="$CLI_TOKEN"
    API_KEYS=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null || echo "")
    if [ -n "$API_KEYS" ]; then
        SERVICE_ROLE_KEY=$(echo "$API_KEYS" | grep -i "service_role\|service" | head -1 | awk '{print $NF}' | tr -d '\n' || echo "")
    fi
fi

# Método 2: Tentar via API REST do Supabase
if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "   Tentando via API REST..."
    API_RESPONSE=$(curl -s -X GET \
        "https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys" \
        -H "Authorization: Bearer ${CLI_TOKEN}" \
        -H "Content-Type: application/json" 2>/dev/null || echo "")
    
    if [ -n "$API_RESPONSE" ]; then
        SERVICE_ROLE_KEY=$(echo "$API_RESPONSE" | grep -o '"service_role"[^}]*"api_key":"[^"]*' | grep -o 'api_key":"[^"]*' | cut -d'"' -f3 || echo "")
    fi
fi

# Se ainda não tiver, pedir ao usuário
if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo ""
    echo "⚠️  Não foi possível obter Service Role Key automaticamente"
    echo "   Você pode encontrar em:"
    echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
    echo "   Role: service_role (secret)"
    echo ""
    read -p "Digite o Service Role Key (ou pressione Enter para pular): " SERVICE_ROLE_KEY
    
    if [ -z "$SERVICE_ROLE_KEY" ]; then
        echo "❌ Service Role Key é obrigatória para criar usuário via API"
        echo ""
        echo "💡 Alternativa: Use o SQL após criar usuário manualmente no Dashboard"
        echo "   1. Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/users"
        echo "   2. Execute: CRIAR-USUARIO-ORGANIZACAO-SQL-SIMPLES.sql"
        exit 1
    fi
fi

echo "✅ Service Role Key obtida"
echo ""

# ============================================
# 1. Criar usuário via API Admin
# ============================================
echo "1️⃣ Criando usuário: $EMAIL..."

# Verificar se usuário já existe
EXISTING_USER=$(curl -s -X GET \
    "${SUPABASE_URL}/auth/v1/admin/users?email=eq.${EMAIL}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

USER_COUNT=$(echo "$EXISTING_USER" | grep -o '"id"' | wc -l || echo "0")

if [ "$USER_COUNT" -gt 0 ]; then
    echo "⚠️  Usuário já existe, obtendo ID..."
    USER_ID=$(echo "$EXISTING_USER" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "✅ Usuário encontrado: $USER_ID"
else
    # Criar novo usuário
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
            }
        }" 2>&1)
    
    # Extrair USER_ID da resposta
    USER_ID=$(echo "$USER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    
    if [ -z "$USER_ID" ]; then
        echo "❌ Erro ao criar usuário"
        echo "Resposta: $USER_RESPONSE" | head -10
        exit 1
    fi
    
    echo "✅ Usuário criado: $USER_ID"
fi

# ============================================
# 2. Criar/atualizar perfil
# ============================================
echo ""
echo "2️⃣ Criando/atualizando perfil..."

PROFILE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/profiles" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "{
        \"id\": \"${USER_ID}\",
        \"email\": \"${EMAIL}\",
        \"full_name\": \"PubDigital\"
    }" 2>&1)

if echo "$PROFILE_RESPONSE" | grep -q "error\|Error"; then
    echo "⚠️  Erro ao criar perfil (pode já existir): $PROFILE_RESPONSE"
else
    echo "✅ Perfil criado/atualizado"
fi

# ============================================
# 3. Criar organização
# ============================================
echo ""
echo "3️⃣ Criando organização: $ORGANIZACAO..."

# Verificar se organização já existe (buscar por name, não slug)
EXISTING_ORG=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/organizations?name=eq.${ORGANIZACAO}&select=id" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

ORG_ID=$(echo "$EXISTING_ORG" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$ORG_ID" ]; then
    # Criar organização (sem slug, apenas name)
    ORG_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/organizations" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "{
            \"name\": \"${ORGANIZACAO}\"
        }" 2>&1)
    
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

# ============================================
# 4. Associar usuário à organização
# ============================================
echo ""
echo "4️⃣ Associando usuário à organização como owner..."

# Verificar se associação já existe
EXISTING_MEMBER=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${ORG_ID}&user_id=eq.${USER_ID}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "[]")

MEMBER_COUNT=$(echo "$EXISTING_MEMBER" | grep -o '"id"' | wc -l || echo "0")

if [ "$MEMBER_COUNT" -gt 0 ]; then
    echo "⚠️  Associação já existe, atualizando role para owner..."
    # Atualizar role
    curl -s -X PATCH "${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${ORG_ID}&user_id=eq.${USER_ID}" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "{\"role\": \"owner\"}" > /dev/null
    echo "✅ Role atualizada para owner"
else
    # Criar associação
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
        echo "❌ Erro ao associar usuário"
        echo "Resposta: $MEMBER_RESPONSE" | head -10
        exit 1
    fi
    
    echo "✅ Usuário associado como owner"
fi

# ============================================
# 5. Verificar resultado
# ============================================
echo ""
echo "5️⃣ Verificando resultado..."

VERIFY_RESPONSE=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/rpc/verify_user_org" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"user_email\": \"${EMAIL}\"}" 2>/dev/null || echo "")

# Verificação simples via query
VERIFY_QUERY=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/profiles?id=eq.${USER_ID}&select=id,email,full_name" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" 2>/dev/null || echo "")

if echo "$VERIFY_QUERY" | grep -q "$EMAIL"; then
    echo "✅ Verificação OK: Perfil encontrado"
else
    echo "⚠️  Verificação: Perfil pode não estar visível via REST API"
fi

# ============================================
# Resumo final
# ============================================
echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ CONCLUÍDO COM SUCESSO!            ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📋 Credenciais criadas:"
echo "   Email: $EMAIL"
echo "   Senha: $SENHA"
echo "   Organização: $ORGANIZACAO"
echo "   User ID: $USER_ID"
echo "   Org ID: $ORG_ID"
echo ""
echo "🌐 Acesse a aplicação:"
echo "   https://agilizeflow.com.br"
echo ""
echo "🔐 Faça login com:"
echo "   Email: $EMAIL"
echo "   Senha: $SENHA"
echo ""



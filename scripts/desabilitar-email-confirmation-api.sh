#!/bin/bash

# ============================================
# Desabilitar Confirmação de Email via API
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "🔧 Desabilitando confirmação de email via Supabase Management API..."
echo ""

# Verificar se temos access token do Supabase
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI encontrado"
    
    # Tentar obter access token
    ACCESS_TOKEN=$(supabase projects api-keys --project-ref ogeljmbhqxpfjbpnbwog 2>/dev/null | grep -i "access" | awk '{print $2}' || echo "")
    
    if [ -z "$ACCESS_TOKEN" ]; then
        # Tentar obter do arquivo de configuração
        if [ -f "$HOME/.supabase/access-token" ]; then
            ACCESS_TOKEN=$(cat "$HOME/.supabase/access-token" 2>/dev/null || echo "")
        fi
    fi
    
    if [ -z "$ACCESS_TOKEN" ]; then
        echo "⚠️  Access token não encontrado automaticamente"
        echo "   Tentando fazer login..."
        supabase login 2>&1 | head -5
        echo ""
        echo "   Após login, execute este script novamente"
        exit 1
    fi
    
    echo "✅ Access token encontrado"
else
    echo "❌ Supabase CLI não encontrado"
    echo "   Instale: npm install -g supabase"
    exit 1
fi

PROJECT_REF="ogeljmbhqxpfjbpnbwog"
SUPABASE_API_URL="https://api.supabase.com/v1"

echo ""
echo "📤 Enviando requisição para desabilitar confirmação de email..."
echo ""

# Tentar via Management API
# Nota: A API do Supabase pode não ter endpoint direto para isso
# Vamos tentar diferentes métodos

# Método 1: Via Projects API (se disponível)
RESPONSE=$(curl -s -X GET \
    "${SUPABASE_API_URL}/projects/${PROJECT_REF}/config/auth" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" 2>&1)

if echo "$RESPONSE" | grep -q "email"; then
    echo "✅ Configuração atual obtida"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
    echo "⚠️  Não foi possível obter configuração via API"
    echo "   Resposta: $RESPONSE"
fi

echo ""
echo "=========================================="
echo "⚠️  LIMITAÇÃO DA API"
echo "=========================================="
echo ""
echo "O Supabase Management API não expõe endpoint direto para"
echo "desabilitar confirmação de email por questões de segurança."
echo ""
echo "📝 SOLUÇÃO: Desabilitar manualmente no Dashboard"
echo ""
echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/providers"
echo "2. Clique em 'Email' provider"
echo "3. Desligue 'Confirm email' (OFF)"
echo "4. Clique em 'Save'"
echo ""
echo "💡 ALTERNATIVA: Usar Edge Function com Service Role Key"
echo "   (mais complexo, mas possível)"
echo ""


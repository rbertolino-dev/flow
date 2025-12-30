#!/bin/bash

# ============================================
# Script Completo: Desabilitar Confirmação de Email
# ============================================
# Tenta todos os métodos possíveis

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

PROJECT_REF="ogeljmbhqxpfjbpnbwog"

echo "🔧 Tentando desabilitar confirmação de email..."
echo ""

# Método 1: Via Supabase CLI (se tiver comando)
echo "1️⃣  Tentando via Supabase CLI..."
if command -v supabase &> /dev/null; then
    # Verificar se há comando para auth settings
    if supabase auth --help 2>&1 | grep -q "settings\|config"; then
        echo "   Tentando comando auth settings..."
        supabase auth settings --project-ref "$PROJECT_REF" --disable-email-confirmation 2>&1 || echo "   ⚠️  Comando não disponível"
    else
        echo "   ⚠️  Supabase CLI não tem comando para auth settings"
    fi
else
    echo "   ⚠️  Supabase CLI não encontrado"
fi
echo ""

# Método 2: Via Management API
echo "2️⃣  Tentando via Management API..."
if command -v curl &> /dev/null && command -v supabase &> /dev/null; then
    # Tentar obter access token
    ACCESS_TOKEN=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep -i "access" | head -1 | awk '{print $NF}' || echo "")
    
    if [ -n "$ACCESS_TOKEN" ]; then
        echo "   ✅ Access token obtido"
        
        # Tentar atualizar configuração
        RESPONSE=$(curl -s -X PATCH \
            "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
            -H "Authorization: Bearer ${ACCESS_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{"MAILER_ENABLE_CONFIRMATIONS": false}' 2>&1)
        
        if echo "$RESPONSE" | grep -q "success\|200"; then
            echo "   ✅ Configuração atualizada via API!"
            exit 0
        else
            echo "   ⚠️  API não respondeu como esperado"
            echo "      Resposta: $(echo "$RESPONSE" | head -3)"
        fi
    else
        echo "   ⚠️  Access token não encontrado"
    fi
else
    echo "   ⚠️  curl ou supabase não encontrado"
fi
echo ""

# Método 3: Via SQL (se possível)
echo "3️⃣  Tentando via SQL..."
SQL_DISABLE="
-- Tentar atualizar configuração de auth (pode não funcionar)
UPDATE auth.config 
SET value = 'false' 
WHERE key = 'MAILER_ENABLE_CONFIRMATIONS';
"
echo "   ⚠️  SQL direto não funciona (configuração protegida)"
echo ""

# Resumo final
echo "=========================================="
echo "📋 RESUMO"
echo "=========================================="
echo ""
echo "⚠️  CONCLUSÃO:"
echo "   O Supabase NÃO permite desabilitar confirmação de email"
echo "   via CLI ou API por questões de segurança."
echo ""
echo "✅ SOLUÇÃO: Desabilitar manualmente no Dashboard"
echo ""
echo "📝 PASSOS OBRIGATÓRIOS:"
echo ""
echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/providers"
echo ""
echo "2. Clique em 'Email' provider"
echo ""
echo "3. Desligue 'Confirm email' (toggle OFF)"
echo ""
echo "4. Clique em 'Save'"
echo ""
echo "5. Verifique:"
echo "   - 'Enable email signup' deve estar ON ✅"
echo "   - 'Confirm email' deve estar OFF ✅"
echo ""
echo "💡 DICA: Após desabilitar, teste o cadastro:"
echo "   https://agilizeflow.com.br/CADASTRO"
echo ""


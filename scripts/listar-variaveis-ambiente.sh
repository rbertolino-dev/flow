#!/bin/bash
# 🔍 Script para Listar Todas as Variáveis de Ambiente Necessárias
# Analisa todas as Edge Functions e lista variáveis usadas

echo "🔍 Analisando Edge Functions para identificar variáveis de ambiente..."
echo ""

# Variáveis conhecidas do Supabase (automáticas)
echo "📋 VARIÁVEIS DO SUPABASE (Automáticas):"
echo "   SUPABASE_URL"
echo "   SUPABASE_SERVICE_ROLE_KEY"
echo "   SUPABASE_ANON_KEY"
echo ""

# Buscar variáveis nas Edge Functions
echo "📋 VARIÁVEIS ENCONTRADAS NAS EDGE FUNCTIONS:"
echo ""

# Buscar padrões comuns
VARS=$(grep -r "Deno.env.get\|process.env" supabase/functions --include="*.ts" 2>/dev/null | \
    grep -oE '"(SUPABASE_|FACEBOOK_|EVOLUTION_|CHATWOOT_|GOOGLE_|MERCADO_|ASAAS_|N8N_|OPENAI_|HUBSPOT_|BUBBLE_|DEEPSEEK_|TEST_|WHATSAPP_)[A-Z_]*"' | \
    sed 's/"//g' | sort -u)

if [ -n "$VARS" ]; then
    echo "$VARS" | while read -r var; do
        echo "   $var"
    done
else
    echo "   (Nenhuma variável encontrada no padrão de busca)"
fi

echo ""
echo "📋 VARIÁVEIS DOCUMENTADAS (Verificar manualmente):"
echo ""
echo "   Facebook/Instagram:"
echo "   - FACEBOOK_APP_ID"
echo "   - FACEBOOK_APP_SECRET"
echo "   - FACEBOOK_CLIENT_TOKEN"
echo "   - FACEBOOK_WEBHOOK_VERIFY_TOKEN"
echo ""
echo "   WhatsApp/Evolution:"
echo "   - EVOLUTION_API_URL"
echo "   - EVOLUTION_API_KEY"
echo "   - TEST_MODE"
echo "   - WHATSAPP_TEST_PHONE"
echo "   - WHATSAPP_LOG_ONLY"
echo ""
echo "   Chatwoot:"
echo "   - CHATWOOT_API_URL"
echo "   - CHATWOOT_API_TOKEN"
echo "   - CHATWOOT_PLATFORM_APP_TOKEN"
echo ""
echo "   Google Services:"
echo "   - GOOGLE_CLIENT_ID (Calendar/Gmail/Business)"
echo "   - GOOGLE_CLIENT_SECRET (Calendar/Gmail/Business)"
echo "   - GOOGLE_CALENDAR_CLIENT_ID"
echo "   - GOOGLE_CALENDAR_CLIENT_SECRET"
echo "   - GOOGLE_GMAIL_CLIENT_ID"
echo "   - GOOGLE_GMAIL_CLIENT_SECRET"
echo "   - GOOGLE_BUSINESS_CLIENT_ID"
echo "   - GOOGLE_BUSINESS_CLIENT_SECRET"
echo ""
echo "   Pagamentos:"
echo "   - MERCADO_PAGO_ACCESS_TOKEN"
echo "   - MERCADO_PAGO_PUBLIC_KEY"
echo "   - MERCADO_PAGO_WEBHOOK_SECRET"
echo "   - ASAAS_API_KEY"
echo "   - ASAAS_API_URL"
echo "   - ASAAS_WEBHOOK_TOKEN"
echo ""
echo "   Outros:"
echo "   - N8N_API_URL"
echo "   - N8N_API_KEY"
echo "   - OPENAI_API_KEY"
echo "   - OPENAI_ORG_ID"
echo "   - HUBSPOT_ACCESS_TOKEN"
echo "   - BUBBLE_API_TOKEN"
echo "   - DEEPSEEK_API_KEY"
echo ""
echo "💡 Dica: Consulte VARIAVEIS-AMBIENTE-COMPLETAS.md para lista completa"

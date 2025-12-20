#!/bin/bash

# Script para configurar as credenciais do Google Calendar no Supabase
# Uso: ./configurar-google-calendar-secrets.sh

echo "🔐 Configurando Credenciais do Google Calendar no Supabase"
echo "============================================================"
echo ""

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado!"
    echo ""
    echo "Instale o Supabase CLI:"
    echo "  npm install -g supabase"
    echo ""
    echo "Ou configure manualmente via Dashboard:"
    echo "  https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/functions"
    exit 1
fi

# Verificar se está logado
if ! supabase projects list &> /dev/null; then
    echo "❌ Você precisa fazer login no Supabase CLI primeiro!"
    echo ""
    echo "Execute:"
    echo "  supabase login"
    exit 1
fi

# Credenciais (substitua pelos seus valores reais)
# Obtenha em: https://console.cloud.google.com/apis/credentials
CLIENT_ID="SEU_CLIENT_ID_AQUI"
CLIENT_SECRET="SEU_CLIENT_SECRET_AQUI"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

echo "📋 Credenciais a configurar:"
echo "  Client ID: ${CLIENT_ID:0:30}..."
echo "  Client Secret: ${CLIENT_SECRET:0:20}..."
echo ""
echo "Projeto: ${PROJECT_REF}"
echo ""

read -p "Deseja continuar? (s/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operação cancelada."
    exit 1
fi

echo ""
echo "⏳ Configurando variáveis..."

# Configurar Client ID
echo "  → Configurando GOOGLE_CALENDAR_CLIENT_ID..."
supabase secrets set GOOGLE_CALENDAR_CLIENT_ID="$CLIENT_ID" --project-ref "$PROJECT_REF"

if [ $? -eq 0 ]; then
    echo "  ✅ GOOGLE_CALENDAR_CLIENT_ID configurado com sucesso!"
else
    echo "  ❌ Erro ao configurar GOOGLE_CALENDAR_CLIENT_ID"
    exit 1
fi

# Configurar Client Secret
echo "  → Configurando GOOGLE_CALENDAR_CLIENT_SECRET..."
supabase secrets set GOOGLE_CALENDAR_CLIENT_SECRET="$CLIENT_SECRET" --project-ref "$PROJECT_REF"

if [ $? -eq 0 ]; then
    echo "  ✅ GOOGLE_CALENDAR_CLIENT_SECRET configurado com sucesso!"
else
    echo "  ❌ Erro ao configurar GOOGLE_CALENDAR_CLIENT_SECRET"
    exit 1
fi

echo ""
echo "✅ Credenciais configuradas com sucesso!"
echo ""
echo "📝 Próximos passos:"
echo "  1. Verifique o Redirect URI no Google Cloud Console:"
echo "     https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/google-calendar-oauth-callback"
echo ""
echo "  2. Teste a integração em:"
echo "     /calendar → Aba 'Integração' → 'Conectar com Google'"
echo ""



#!/bin/bash

# Script para aplicar SQL return_date diretamente via curl
# Usa Supabase Management API

set -e

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"

# SQL para aplicar
SQL="ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE; CREATE INDEX IF NOT EXISTS idx_leads_return_date ON public.leads(return_date) WHERE return_date IS NOT NULL; COMMENT ON COLUMN public.leads.return_date IS 'Data de retorno agendada para o lead';"

echo "🚀 Aplicando SQL return_date via Supabase..."
echo "📋 Projeto: $PROJECT_ID"
echo ""

# Mostrar SQL
echo "📝 SQL a ser aplicado:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$SQL" | sed 's/; /;\n/g'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "⚠️  Como o Supabase não permite executar SQL arbitrário via API REST,"
echo "   você precisa aplicar manualmente via SQL Editor:"
echo ""
echo "1. Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
echo ""
echo "2. Cole o SQL acima"
echo ""
echo "3. Execute (Run)"
echo ""
echo "✅ Após aplicar, o erro será resolvido!"


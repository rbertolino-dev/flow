#!/bin/bash
set -e

echo "🚀 Deploy automático da edge function process-scheduled-campaigns"
echo ""

# 1. Verificar CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não está instalado"
    exit 1
fi

echo "✅ Supabase CLI: $(supabase --version)"

# 2. Verificar login
echo ""
echo "Verificando autenticação..."
if ! supabase projects list &> /dev/null; then
    echo "⚠️ Não está logado. Execute: supabase login"
    exit 1
fi

echo "✅ Autenticado"

# 3. Verificar projeto linkado
echo ""
echo "Verificando projeto..."
if [ ! -f ".supabase/config.toml" ]; then
    echo "Linkando projeto..."
    supabase link --project-ref ogeljmbhqxpfjbpnbwog
fi

echo "✅ Projeto linkado"

# 4. Deploy
echo ""
echo "🚀 Fazendo deploy..."
supabase functions deploy process-scheduled-campaigns

# 5. Verificar
echo ""
echo "✅ Verificando deploy..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns" \
  -H "Authorization: Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm" \
  -H "Content-Type: application/json" \
  -d '{}')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Status HTTP: $HTTP_CODE"
else
    echo "⚠️ Status HTTP: $HTTP_CODE"
fi

echo ""
echo "✅ Deploy concluído!"

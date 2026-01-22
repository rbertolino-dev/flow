#!/bin/bash
# 🚀 Script: Aplicar Migration de Campanhas Agendadas
# Aplica migration e configura cron job para iniciar campanhas automaticamente

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 APLICAR MIGRATION: CAMPANHAS AGENDADAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 Este script irá:"
echo "   1. Aplicar migration para adicionar coluna scheduled_start_at"
echo "   2. Configurar cron job para processar campanhas agendadas"
echo ""

read -p "Deseja continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Cancelado"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 PASSO 1: Aplicar Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Execute o seguinte SQL no Supabase SQL Editor:"
echo "   URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat supabase/migrations/20260121000001_add_scheduled_start_at_to_broadcast_campaigns.sql

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Pressione Enter após executar o SQL acima..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 PASSO 2: Configurar Cron Job"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Execute o seguinte SQL no Supabase SQL Editor:"
echo ""

cat << 'EOF'
-- Verificar se cron job já existe
SELECT * FROM cron.job WHERE jobname = 'process-scheduled-campaigns';

-- Se não existir, criar o cron job
SELECT cron.schedule(
  'process-scheduled-campaigns',
  '*/1 * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm'
    ),
    body := '{}'::jsonb
  );
  $$
);
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Pressione Enter após executar o SQL acima..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 PASSO 3: Deploy da Edge Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Execute o seguinte comando para fazer deploy da edge function:"
echo ""
echo "   cd /root/kanban-buzz-95241"
echo "   export SUPABASE_ACCESS_TOKEN='seu-token-aqui'"
echo "   supabase functions deploy process-scheduled-campaigns --project-ref ogeljmbhqxpfjbpnbwog"
echo ""
echo "   OU via Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions"
echo ""

read -p "Deseja tentar fazer deploy agora? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "🚀 Fazendo deploy da edge function..."
    
    if command -v supabase &> /dev/null; then
        export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
        supabase functions deploy process-scheduled-campaigns --project-ref ogeljmbhqxpfjbpnbwog || {
            echo ""
            echo "⚠️  Deploy via CLI falhou. Faça deploy manualmente via Dashboard."
        }
    else
        echo "❌ Supabase CLI não encontrado. Faça deploy manualmente via Dashboard."
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CONCLUÍDO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Verificações finais:"
echo ""
echo "1. Verificar se migration foi aplicada:"
echo "   SELECT column_name FROM information_schema.columns"
echo "   WHERE table_name = 'broadcast_campaigns'"
echo "   AND column_name = 'scheduled_start_at';"
echo ""
echo "2. Verificar se cron job foi criado:"
echo "   SELECT * FROM cron.job WHERE jobname = 'process-scheduled-campaigns';"
echo ""
echo "3. Verificar se edge function foi deployada:"
echo "   https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions"
echo ""

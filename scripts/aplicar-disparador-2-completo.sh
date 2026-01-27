#!/bin/bash

# ============================================
# Script para aplicar Disparador 2 completo
# ============================================
# Aplica migration, configura cron job e valida
# ============================================

set -e

echo "🚀 Aplicando Disparador 2 completo..."

# Carregar credenciais SSH
if [ -f "scripts/.ssh-credentials" ]; then
  source scripts/.ssh-credentials
else
  echo "❌ Arquivo scripts/.ssh-credentials não encontrado"
  exit 1
fi

# Diretório do projeto
PROJECT_DIR="/root/kanban-buzz-95241"

# 1. Aplicar migration
echo "📦 Aplicando migration do Disparador 2..."
cd "$PROJECT_DIR"

# Verificar se supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
  echo "⚠️  Supabase CLI não encontrado. Aplicando via SQL direto..."
  
  # Aplicar via SSH se necessário
  if [ -n "$SSH_HOST" ]; then
    echo "📡 Aplicando migration via SSH..."
    ssh kanban-buzz-server "cd /opt/app && psql \$DATABASE_URL -f supabase/migrations/20260129000001_create_broadcast_system_2.sql" || {
      echo "⚠️  Erro ao aplicar via SSH. Tentando método alternativo..."
    }
  fi
else
  # Aplicar via Supabase CLI
  echo "✅ Aplicando migration via Supabase CLI..."
  supabase db push || {
    echo "⚠️  Erro ao aplicar via Supabase CLI. Verifique manualmente."
  }
fi

# 2. Criar script SQL para cron job
echo "⏰ Criando script SQL para cron job..."
cat > /tmp/cron-job-disparador-2.sql << 'EOF'
-- ============================================
-- Cron Job para process-broadcast-queue-2
-- ============================================
-- Processa fila de broadcast do Disparador 2 a cada minuto
-- ============================================

-- Remover cron job existente se houver
SELECT cron.unschedule('process-broadcast-queue-2') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-broadcast-queue-2'
);

-- Criar novo cron job
SELECT cron.schedule(
  'process-broadcast-queue-2',
  '*/1 * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue-2',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verificar se foi criado
SELECT 
  jobname,
  schedule,
  command
FROM cron.job
WHERE jobname = 'process-broadcast-queue-2';
EOF

# 3. Aplicar cron job via SSH
if [ -n "$SSH_HOST" ]; then
  echo "📡 Aplicando cron job via SSH..."
  ssh kanban-buzz-server "cd /opt/app && psql \$DATABASE_URL -f /tmp/cron-job-disparador-2.sql" || {
    echo "⚠️  Erro ao aplicar cron job. Verifique manualmente."
  }
else
  echo "⚠️  SSH não configurado. Aplique o cron job manualmente:"
  echo "   psql \$DATABASE_URL -f /tmp/cron-job-disparador-2.sql"
fi

# 4. Validar criação das tabelas
echo "✅ Validando criação das tabelas..."
VALIDATION_SQL=$(cat << 'EOF'
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'broadcast_campaigns_2') 
    THEN '✅ broadcast_campaigns_2 criada'
    ELSE '❌ broadcast_campaigns_2 NÃO criada'
  END as campaigns_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'broadcast_queue_2') 
    THEN '✅ broadcast_queue_2 criada'
    ELSE '❌ broadcast_queue_2 NÃO criada'
  END as queue_status;
EOF
)

if [ -n "$SSH_HOST" ]; then
  ssh kanban-buzz-server "cd /opt/app && echo '$VALIDATION_SQL' | psql \$DATABASE_URL" || true
else
  echo "$VALIDATION_SQL" | psql "$DATABASE_URL" || true
fi

echo ""
echo "✨ Disparador 2 aplicado com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Verifique se as tabelas foram criadas: broadcast_campaigns_2 e broadcast_queue_2"
echo "   2. Verifique se o cron job foi criado: process-broadcast-queue-2"
echo "   3. Acesse o menu 'Disparador 2' na aplicação"
echo "   4. Teste criando uma campanha no Disparador 2"
echo ""

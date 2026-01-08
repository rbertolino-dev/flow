#!/bin/bash

# Script para executar correção do cron job via psql
# Usa a SERVICE_ROLE_KEY obtida automaticamente

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SERVICE_ROLE_KEY="2e723fdacb9da5cbf2df45d26761d2453e639bee91fde346b9a0f7ff67a6cebc"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

echo -e "${YELLOW}🚀 Executando correção do cron job via psql...${NC}"

# Verificar se psql está disponível
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql não encontrado${NC}"
    echo ""
    echo "Execute o SQL manualmente no Supabase SQL Editor:"
    echo "Arquivo: scripts/corrigir-cron-job-com-chave-obtida.sql"
    exit 1
fi

# Construir URL de conexão
DB_URL="postgresql://postgres.${PROJECT_REF}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

echo -e "${YELLOW}📝 Executando SQL...${NC}"

# Executar SQL
psql "$DB_URL" <<EOF
-- Remover cron job antigo (se existir)
SELECT cron.unschedule('process-broadcast-queue');

-- Criar novo cron job com chave correta
SELECT cron.schedule(
  'process-broadcast-queue',
  '*/1 * * * *',
  \$\$
  SELECT net.http_post(
    url := 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$\$
);

-- Verificar se foi criado corretamente
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ Usando chave JWT (correto)'
    WHEN command LIKE '%Bearer%' AND LENGTH(command) > 200 THEN '✅ Comando parece correto'
    WHEN command LIKE '%[SERVICE_ROLE_KEY]%' THEN '❌ Placeholder ainda não substituído'
    WHEN command LIKE '%sb_publishable%' THEN '❌ Usando chave PUBLISHABLE (errado)'
    ELSE '⚠️ Verificar manualmente'
  END as status_chave
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Cron job corrigido com sucesso!${NC}"
else
    echo ""
    echo -e "${RED}❌ Erro ao executar SQL${NC}"
    echo "Execute manualmente: scripts/corrigir-cron-job-com-chave-obtida.sql"
    exit 1
fi



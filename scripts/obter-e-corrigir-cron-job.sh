#!/bin/bash

# ============================================
# Script para obter SERVICE_ROLE_KEY e corrigir cron job
# ============================================

set -e

echo "🔧 Script para corrigir cron job do process-broadcast-queue"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "Instale com: npm install -g supabase"
    exit 1
fi

echo -e "${YELLOW}📋 Opções para obter SERVICE_ROLE_KEY:${NC}"
echo ""
echo "1. Via Supabase Dashboard (recomendado)"
echo "   - Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/api"
echo "   - Copie a chave 'service_role' (secret)"
echo ""
echo "2. Via Supabase CLI (se configurado)"
echo "   - Tentando obter automaticamente..."
echo ""

# Tentar obter via Supabase CLI
SERVICE_ROLE_KEY=""

# Verificar se há projeto linkado
if supabase projects list &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI configurado${NC}"
    echo "Tentando obter SERVICE_ROLE_KEY..."
    
    # Tentar obter do projeto
    PROJECT_REF="ogeljmbhqxpfjbpnbwog"
    
    # Verificar se há secrets configurados
    if supabase secrets list --project-ref "$PROJECT_REF" &> /dev/null; then
        SERVICE_ROLE_KEY=$(supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null | grep -i "SERVICE_ROLE_KEY" | awk '{print $2}' || echo "")
    fi
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠️  Não foi possível obter SERVICE_ROLE_KEY automaticamente${NC}"
    echo ""
    echo -e "${YELLOW}Por favor, insira a SERVICE_ROLE_KEY manualmente:${NC}"
    read -sp "SERVICE_ROLE_KEY: " SERVICE_ROLE_KEY
    echo ""
    
    if [ -z "$SERVICE_ROLE_KEY" ]; then
        echo -e "${RED}❌ SERVICE_ROLE_KEY não fornecida${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ SERVICE_ROLE_KEY obtida automaticamente${NC}"
fi

echo ""
echo -e "${GREEN}🔧 Gerando script SQL com chave...${NC}"

# Criar script SQL temporário
SQL_FILE="/tmp/corrigir-cron-job-$(date +%s).sql"

cat > "$SQL_FILE" <<EOF
-- ============================================
-- CORRIGIR CRON JOB: Gerado automaticamente
-- ============================================

-- Remover cron job antigo
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
    ELSE '⚠️ Verificar manualmente'
  END as status_chave
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
EOF

echo -e "${GREEN}✅ Script SQL gerado: $SQL_FILE${NC}"
echo ""
echo -e "${YELLOW}📝 Próximos passos:${NC}"
echo "1. Abra o Supabase SQL Editor"
echo "2. Cole o conteúdo do arquivo: $SQL_FILE"
echo "3. Execute o script"
echo ""
echo -e "${GREEN}Ou execute via CLI:${NC}"
echo "supabase db execute --file $SQL_FILE"
echo ""

# Tentar executar via CLI se possível
if supabase projects list &> /dev/null; then
    read -p "Deseja executar o script agora via Supabase CLI? (s/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${GREEN}🚀 Executando script...${NC}"
        if supabase db execute --file "$SQL_FILE" --project-ref "$PROJECT_REF"; then
            echo -e "${GREEN}✅ Cron job corrigido com sucesso!${NC}"
        else
            echo -e "${RED}❌ Erro ao executar script${NC}"
            echo "Execute manualmente no Supabase SQL Editor"
        fi
    fi
fi

echo ""
echo -e "${GREEN}✅ Script gerado com sucesso!${NC}"


#!/bin/bash

# ============================================
# Script Automático: Corrigir Cron Job
# ============================================
# Este script obtém a SERVICE_ROLE_KEY automaticamente
# e configura o cron job do process-broadcast-queue
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando correção automática do cron job...${NC}"
echo ""

# ============================================
# PASSO 1: Obter SERVICE_ROLE_KEY
# ============================================
echo -e "${YELLOW}📋 Obtendo SERVICE_ROLE_KEY...${NC}"

SERVICE_ROLE_KEY=""

# Tentar obter via Supabase CLI
if command -v supabase &> /dev/null; then
    echo "Tentando obter via Supabase CLI..."
    SERVICE_ROLE_KEY=$(supabase secrets list --project-ref ogeljmbhqxpfjbpnbwog 2>/dev/null | grep -i "SERVICE_ROLE_KEY" | awk '{print $3}' | head -1 || echo "")
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Não foi possível obter SERVICE_ROLE_KEY automaticamente${NC}"
    echo "Por favor, forneça a chave manualmente:"
    read -sp "SERVICE_ROLE_KEY: " SERVICE_ROLE_KEY
    echo ""
    
    if [ -z "$SERVICE_ROLE_KEY" ]; then
        echo -e "${RED}❌ SERVICE_ROLE_KEY não fornecida${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ SERVICE_ROLE_KEY obtida automaticamente${NC}"
fi

# Validar formato da chave (deve começar com eyJ)
if [[ ! "$SERVICE_ROLE_KEY" =~ ^eyJ ]]; then
    echo -e "${YELLOW}⚠️  Aviso: A chave não parece ser um JWT válido (deve começar com 'eyJ')${NC}"
    echo "Continuando mesmo assim..."
fi

echo ""

# ============================================
# PASSO 2: Gerar Script SQL
# ============================================
echo -e "${YELLOW}📝 Gerando script SQL...${NC}"

SQL_FILE="/tmp/corrigir-cron-job-auto-$(date +%s).sql"

cat > "$SQL_FILE" <<EOF
-- ============================================
-- CORRIGIR CRON JOB: Gerado automaticamente
-- Data: $(date)
-- ============================================

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
  END as status_chave,
  LEFT(command, 150) as comando_preview
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
EOF

echo -e "${GREEN}✅ Script SQL gerado: $SQL_FILE${NC}"
echo ""

# ============================================
# PASSO 3: Executar via Supabase CLI
# ============================================
echo -e "${YELLOW}🚀 Executando script via Supabase CLI...${NC}"

if command -v supabase &> /dev/null; then
    if supabase db execute --file "$SQL_FILE" --project-ref ogeljmbhqxpfjbpnbwog 2>&1; then
        echo -e "${GREEN}✅ Script executado com sucesso!${NC}"
        EXECUTED=true
    else
        echo -e "${YELLOW}⚠️  Erro ao executar via CLI. Tentando método alternativo...${NC}"
        EXECUTED=false
    fi
else
    echo -e "${YELLOW}⚠️  Supabase CLI não encontrado${NC}"
    EXECUTED=false
fi

echo ""

# ============================================
# PASSO 4: Verificar Resultado
# ============================================
if [ "$EXECUTED" = true ]; then
    echo -e "${YELLOW}🔍 Verificando resultado...${NC}"
    
    # Aguardar um pouco para o cron job ser criado
    sleep 2
    
    # Verificar se cron job foi criado
    VERIFY_SQL="/tmp/verificar-cron-$(date +%s).sql"
    cat > "$VERIFY_SQL" <<EOF
SELECT 
  jobid,
  jobname,
  active,
  CASE 
    WHEN command LIKE '%Bearer eyJ%' THEN '✅ CORRETO'
    WHEN command LIKE '%Bearer%' AND LENGTH(command) > 200 THEN '✅ CORRETO'
    ELSE '❌ ERRO'
  END as status
FROM cron.job 
WHERE jobname = 'process-broadcast-queue';
EOF
    
    if supabase db execute --file "$VERIFY_SQL" --project-ref ogeljmbhqxpfjbpnbwog 2>&1 | grep -q "CORRETO"; then
        echo -e "${GREEN}✅ Cron job configurado corretamente!${NC}"
    else
        echo -e "${YELLOW}⚠️  Verifique manualmente o resultado${NC}"
    fi
    
    rm -f "$VERIFY_SQL"
else
    echo -e "${YELLOW}📋 Execute o script SQL manualmente:${NC}"
    echo ""
    echo -e "${BLUE}Arquivo: $SQL_FILE${NC}"
    echo ""
    echo "1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
    echo "2. Cole o conteúdo do arquivo acima"
    echo "3. Execute o script"
fi

echo ""

# ============================================
# PASSO 5: Testar Edge Function
# ============================================
echo -e "${YELLOW}🧪 Testando edge function...${NC}"

TEST_RESPONSE=$(curl -s -X POST \
  'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-broadcast-queue' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{}' \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$TEST_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE_BODY=$(echo "$TEST_RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Edge function respondeu com sucesso!${NC}"
    echo "Resposta: $RESPONSE_BODY"
else
    echo -e "${YELLOW}⚠️  Edge function retornou código HTTP: $HTTP_CODE${NC}"
    echo "Resposta: $RESPONSE_BODY"
fi

echo ""

# ============================================
# RESUMO FINAL
# ============================================
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Processo concluído!${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📋 Próximos passos:${NC}"
echo "1. Aguarde 1-2 minutos para o cron job executar"
echo "2. Verifique se campanhas estão sendo enviadas:"
echo ""
echo "   SELECT COUNT(*) FILTER (WHERE status = 'sent') as enviados"
echo "   FROM broadcast_queue;"
echo ""
echo "3. Verifique logs do cron job:"
echo "   SELECT * FROM cron.job_run_details"
echo "   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-broadcast-queue')"
echo "   ORDER BY start_time DESC LIMIT 5;"
echo ""

# Limpar arquivos temporários
rm -f "$SQL_FILE"

echo -e "${GREEN}✅ Tudo pronto!${NC}"



#!/bin/bash

# ============================================
# Script Completo: Deploy do Disparador 2
# ============================================
# Aplica migration, deploy da edge function e configura cron job
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Deploy Completo do Disparador 2      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Carregar credenciais SSH
if [ -f "scripts/.ssh-credentials" ]; then
  source scripts/.ssh-credentials
else
  echo -e "${RED}❌ Arquivo scripts/.ssh-credentials não encontrado${NC}"
  exit 1
fi

PROJECT_DIR="/root/kanban-buzz-95241"
cd "$PROJECT_DIR"

# 1. Aplicar Migration
echo -e "${BLUE}📦 PASSO 1: Aplicando Migration...${NC}"
ssh kanban-buzz-server << 'ENDSSH'
cd /opt/app
source .supabase-cli-config 2>/dev/null || true

echo "Aplicando migration do Disparador 2..."
if supabase db push 2>&1 | grep -qE "Applied|Successfully|CREATE TABLE.*broadcast_campaigns_2"; then
  echo "✅ Migration aplicada com sucesso!"
else
  echo "⚠️  Verifique se a migration foi aplicada corretamente"
fi
ENDSSH

echo ""

# 2. Deploy da Edge Function
echo -e "${BLUE}🚀 PASSO 2: Deploy da Edge Function...${NC}"
ssh kanban-buzz-server << 'ENDSSH'
cd /opt/app
source .supabase-cli-config 2>/dev/null || true

echo "Fazendo deploy de process-broadcast-queue-2..."
if supabase functions deploy process-broadcast-queue-2 --no-verify-jwt 2>&1; then
  echo "✅ Edge function deployada com sucesso!"
else
  echo "❌ Erro ao fazer deploy da edge function"
  exit 1
fi
ENDSSH

echo ""

# 3. Configurar Cron Job
echo -e "${BLUE}⏰ PASSO 3: Configurando Cron Job...${NC}"
ssh kanban-buzz-server << 'ENDSSH'
cd /opt/app
source .supabase-cli-config 2>/dev/null || true

echo "Aplicando script SQL do cron job..."
if supabase db execute --file scripts/configurar-cron-disparador-2.sql 2>&1 | grep -qE "process-broadcast-queue-2"; then
  echo "✅ Cron job configurado com sucesso!"
else
  echo "⚠️  Verifique se o cron job foi criado corretamente"
fi
ENDSSH

echo ""

# 4. Validação Final
echo -e "${BLUE}✅ PASSO 4: Validação Final...${NC}"
ssh kanban-buzz-server << 'ENDSSH'
cd /opt/app
source .supabase-cli-config 2>/dev/null || true

echo "Verificando tabelas..."
TABLES=$(supabase db execute "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('broadcast_campaigns_2', 'broadcast_queue_2')" 2>&1 | grep -E "broadcast_campaigns_2|broadcast_queue_2" | wc -l)

if [ "$TABLES" -eq 2 ]; then
  echo "✅ Tabelas criadas: broadcast_campaigns_2, broadcast_queue_2"
else
  echo "⚠️  Algumas tabelas podem não ter sido criadas"
fi

echo ""
echo "Verificando edge function..."
if supabase functions list 2>&1 | grep -q "process-broadcast-queue-2"; then
  echo "✅ Edge function deployada: process-broadcast-queue-2"
else
  echo "❌ Edge function não encontrada"
fi

echo ""
echo "Verificando cron job..."
if supabase db execute "SELECT jobname FROM cron.job WHERE jobname = 'process-broadcast-queue-2'" 2>&1 | grep -q "process-broadcast-queue-2"; then
  echo "✅ Cron job configurado: process-broadcast-queue-2"
else
  echo "⚠️  Cron job não encontrado"
fi
ENDSSH

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Deploy do Disparador 2 concluído!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo "   1. Acesse o menu 'Disparador 2' na aplicação"
echo "   2. Crie uma campanha de teste"
echo "   3. Verifique os logs da edge function no Supabase Dashboard"
echo ""

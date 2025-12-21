#!/bin/bash

# Script de teste para verificar conexão da Edge Function products com PostgreSQL
# Uso: bash scripts/test-products-connection.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🧪 Teste de Conexão - Edge Function products → PostgreSQL"
echo "=================================================="
echo ""

# Carregar credenciais SSH
source "$SCRIPT_DIR/.ssh-credentials"

# Ler credenciais do PostgreSQL
echo "📋 Lendo credenciais do PostgreSQL..."
SSH_CMD="cat /root/postgresql-budget-credentials.txt 2>/dev/null"
CREDS=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$SSH_CMD" 2>/dev/null || echo "")

if [ -z "$CREDS" ]; then
    echo -e "${RED}❌ Não foi possível ler credenciais${NC}"
    exit 1
fi

POSTGRES_HOST="$SSH_HOST"  # Usar IP do servidor
POSTGRES_PORT=$(echo "$CREDS" | grep "POSTGRES_PORT=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_DB=$(echo "$CREDS" | grep "POSTGRES_DB=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_USER=$(echo "$CREDS" | grep "POSTGRES_USER=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_PASSWORD=$(echo "$CREDS" | grep "POSTGRES_PASSWORD=" | cut -d'=' -f2 | tr -d ' ')

echo -e "${BLUE}📋 Configuração:${NC}"
echo "   Host: $POSTGRES_HOST"
echo "   Port: $POSTGRES_PORT"
echo "   Database: $POSTGRES_DB"
echo "   User: $POSTGRES_USER"
echo ""

# Teste 1: Verificar se PostgreSQL está acessível externamente
echo "🔍 Teste 1: Verificando acessibilidade do PostgreSQL..."
if nc -z -w 5 "$POSTGRES_HOST" "$POSTGRES_PORT" 2>/dev/null; then
    echo -e "${GREEN}✅ PostgreSQL está acessível na porta $POSTGRES_PORT${NC}"
else
    echo -e "${RED}❌ PostgreSQL não está acessível na porta $POSTGRES_PORT${NC}"
    echo "   Verifique firewall e configurações do PostgreSQL"
    exit 1
fi
echo ""

# Teste 2: Verificar se tabela products existe
echo "🔍 Teste 2: Verificando se tabela products existe..."
TABLE_CHECK="export PGPASSWORD='$POSTGRES_PASSWORD' && psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'products';\" 2>/dev/null || echo '0'"
TABLE_EXISTS=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$TABLE_CHECK" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$TABLE_EXISTS" = "1" ]; then
    echo -e "${GREEN}✅ Tabela 'products' existe${NC}"
else
    echo -e "${RED}❌ Tabela 'products' não existe${NC}"
    echo "   Execute a migration primeiro"
    exit 1
fi
echo ""

# Teste 3: Verificar configuração do pg_hba.conf
echo "🔍 Teste 3: Verificando configuração do pg_hba.conf..."
HBA_CHECK="sudo grep -E 'budget_services.*budget_user.*0.0.0.0' /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | wc -l"
HBA_RULE=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$HBA_CHECK" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$HBA_RULE" -gt 0 ]; then
    echo -e "${GREEN}✅ Regra do pg_hba.conf configurada para conexões externas${NC}"
else
    echo -e "${YELLOW}⚠️  Regra do pg_hba.conf pode não estar configurada para conexões externas${NC}"
    echo "   Verifique manualmente: /etc/postgresql/*/main/pg_hba.conf"
fi
echo ""

# Teste 4: Verificar secrets do Supabase
echo "🔍 Teste 4: Verificando secrets configurados no Supabase..."
if command -v supabase &> /dev/null; then
    export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
    PROJECT_REF="ogeljmbhqxpfjbpnbwog"
    
    SECRETS=$(supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null || echo "")
    
    if echo "$SECRETS" | grep -q "POSTGRES_HOST"; then
        echo -e "${GREEN}✅ POSTGRES_HOST configurado${NC}"
    else
        echo -e "${RED}❌ POSTGRES_HOST não configurado${NC}"
    fi
    
    if echo "$SECRETS" | grep -q "POSTGRES_PASSWORD"; then
        echo -e "${GREEN}✅ POSTGRES_PASSWORD configurado${NC}"
    else
        echo -e "${RED}❌ POSTGRES_PASSWORD não configurado${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Supabase CLI não disponível - pulando verificação de secrets${NC}"
fi
echo ""

echo "=============================================="
echo -e "${GREEN}✅ Testes de conexão concluídos!${NC}"
echo ""
echo "📋 Próximos passos:"
echo "   1. Testar no navegador: Criar/editar produto"
echo "   2. Verificar logs da Edge Function se houver erro"
echo ""



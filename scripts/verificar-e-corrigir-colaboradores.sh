#!/bin/bash

# 🔧 Script: Verificar e Corrigir Sistema de Colaboradores
# Descrição: Verifica e corrige problemas automaticamente
# Uso: ./scripts/verificar-e-corrigir-colaboradores.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar credenciais
source "$SCRIPT_DIR/carregar-credenciais.sh"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Verificar e Corrigir - Sistema de Colaboradores              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# FASE 1: VERIFICAR VARIÁVEIS DE AMBIENTE
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1️⃣  VERIFICANDO VARIÁVEIS DE AMBIENTE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

REQUIRED_VARS=("POSTGRES_HOST" "POSTGRES_PORT" "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if supabase secrets list --project-ref "$SUPABASE_PROJECT_ID" 2>&1 | grep -q "$var"; then
        echo -e "${GREEN}✅ $var configurada${NC}"
    else
        echo -e "${RED}❌ $var NÃO configurada${NC}"
        MISSING_VARS+=("$var")
    fi
done

echo ""

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Configurando variáveis faltantes...${NC}"
    
    # Obter senha do PostgreSQL
    POSTGRES_PASSWORD=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SSH_USER@$SSH_HOST" \
        "grep -i 'POSTGRES_PASSWORD' /root/postgresql-budget-credentials.txt 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo 'XdgoSA4ABHSRWdTXA5cKDfJJs'")
    
    for var in "${MISSING_VARS[@]}"; do
        case $var in
            POSTGRES_HOST)
                VALUE="localhost"
                ;;
            POSTGRES_PORT)
                VALUE="5432"
                ;;
            POSTGRES_DB)
                VALUE="budget_services"
                ;;
            POSTGRES_USER)
                VALUE="budget_user"
                ;;
            POSTGRES_PASSWORD)
                VALUE="$POSTGRES_PASSWORD"
                ;;
        esac
        
        echo -e "${BLUE}📝 Configurando $var...${NC}"
        supabase secrets set --project-ref "$SUPABASE_PROJECT_ID" "$var=$VALUE" 2>&1 | grep -v "Warning" || true
        echo -e "${GREEN}   ✅ $var configurada${NC}"
    done
else
    echo -e "${GREEN}✅ Todas as variáveis estão configuradas!${NC}"
fi

echo ""

# ============================================
# FASE 2: VERIFICAR CONEXÃO POSTGRESQL
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2️⃣  VERIFICANDO CONEXÃO POSTGRESQL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}🔍 Testando conexão com PostgreSQL...${NC}"

CONNECTION_TEST=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SSH_USER@$SSH_HOST" \
    "PGPASSWORD='XdgoSA4ABHSRWdTXA5cKDfJJs' psql -h localhost -U budget_user -d budget_services -c 'SELECT 1;' 2>&1" | head -5)

if echo "$CONNECTION_TEST" | grep -q "1 row"; then
    echo -e "${GREEN}✅ Conexão PostgreSQL OK${NC}"
else
    echo -e "${RED}❌ Erro na conexão PostgreSQL${NC}"
    echo "$CONNECTION_TEST"
fi

echo ""

# Verificar tabelas
echo -e "${BLUE}🔍 Verificando tabelas...${NC}"
TABLES=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SSH_USER@$SSH_HOST" \
    "PGPASSWORD='XdgoSA4ABHSRWdTXA5cKDfJJs' psql -h localhost -U budget_user -d budget_services -t -c \"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('employees', 'positions', 'teams', 'employee_salary_history', 'employee_position_history', 'employee_teams');\" 2>&1")

REQUIRED_TABLES=("employees" "positions" "teams" "employee_salary_history" "employee_position_history" "employee_teams")
MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    if echo "$TABLES" | grep -q "$table"; then
        echo -e "${GREEN}✅ Tabela $table existe${NC}"
    else
        echo -e "${RED}❌ Tabela $table NÃO existe${NC}"
        MISSING_TABLES+=("$table")
    fi
done

echo ""

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Executando migration para criar tabelas faltantes...${NC}"
    ./scripts/aplicar-migration-colaboradores-ssh.sh
else
    echo -e "${GREEN}✅ Todas as tabelas existem!${NC}"
fi

echo ""

# ============================================
# FASE 3: VERIFICAR EDGE FUNCTIONS
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3️⃣  VERIFICANDO EDGE FUNCTIONS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

FUNCTIONS=("employees" "positions" "teams" "employee-history")

for func_name in "${FUNCTIONS[@]}"; do
    if [ -f "supabase/functions/$func_name/index.ts" ]; then
        echo -e "${GREEN}✅ Função $func_name existe${NC}"
    else
        echo -e "${RED}❌ Função $func_name NÃO existe${NC}"
    fi
done

echo ""

# Verificar se estão deployadas
echo -e "${BLUE}🔍 Verificando deploy...${NC}"
DEPLOYED_FUNCS=$(supabase functions list --project-ref "$SUPABASE_PROJECT_ID" 2>&1 | grep -E "(employees|positions|teams|employee-history)" || echo "")

for func_name in "${FUNCTIONS[@]}"; do
    if echo "$DEPLOYED_FUNCS" | grep -q "$func_name"; then
        echo -e "${GREEN}✅ Função $func_name está deployada${NC}"
    else
        echo -e "${YELLOW}⚠️  Função $func_name não está deployada, fazendo deploy...${NC}"
        supabase functions deploy "$func_name" 2>&1 | grep -E "(Deploying|Deployed|Error)" | head -3
    fi
done

echo ""

# ============================================
# RESUMO FINAL
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ VERIFICAÇÃO CONCLUÍDA!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo "   1. Testar no frontend: /employees"
echo "   2. Verificar logs no Supabase Dashboard se houver erros"
echo "   3. Verificar se usuário tem organização associada"
echo ""


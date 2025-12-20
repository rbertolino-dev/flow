#!/bin/bash

# 🚀 Script: Aplicar Migration de Colaboradores via SSH
# Descrição: Aplica migration do sistema de colaboradores no PostgreSQL via SSH
# Uso: ./scripts/aplicar-migration-colaboradores-ssh.sh

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

if [ -z "$SSH_PASSWORD" ] || [ -z "$SSH_HOST" ]; then
    echo -e "${RED}❌ Credenciais SSH não configuradas${NC}"
    exit 1
fi

# Instalar sshpass se necessário
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}📦 Instalando sshpass...${NC}"
    apt-get update -qq > /dev/null 2>&1
    apt-get install -y -qq sshpass > /dev/null 2>&1
fi

MIGRATION_FILE="supabase/migrations/20251217013247_create_employees_system_postgres.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration - Colaboradores    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📄 Arquivo: $MIGRATION_FILE"
echo "🖥️  Servidor: $SSH_USER@$SSH_HOST"
echo ""

# Copiar arquivo para servidor
echo -e "${BLUE}📤 Copiando migration para servidor...${NC}"
sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$MIGRATION_FILE" "$SSH_USER@$SSH_HOST:/tmp/"

NOME_ARQUIVO=$(basename "$MIGRATION_FILE")

# Executar migration no PostgreSQL
echo ""
echo -e "${BLUE}⚡ Executando migration no PostgreSQL...${NC}"

sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SSH_USER@$SSH_HOST" << 'ENDSSH'
cd /tmp

# Verificar se PostgreSQL está rodando
if ! systemctl is-active --quiet postgresql; then
    echo "⚠️  PostgreSQL não está rodando, tentando iniciar..."
    systemctl start postgresql
    sleep 2
fi

# Obter senha do PostgreSQL
if [ -f "/root/postgresql-budget-credentials.txt" ]; then
    POSTGRES_PASSWORD=$(grep -i "password" /root/postgresql-budget-credentials.txt | cut -d'=' -f2 | tr -d ' ' || echo "")
else
    # Tentar senha padrão conhecida
    POSTGRES_PASSWORD="XdgoSA4ABHSRWdTXA5cKDfJJs"
fi

# Executar migration
echo "📄 Executando: 20251217013247_create_employees_system_postgres.sql"
if PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U budget_user -d budget_services -f "20251217013247_create_employees_system_postgres.sql" 2>&1; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ MIGRATION EXECUTADA COM SUCESSO!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Verificar tabelas criadas
    echo ""
    echo "🔍 Verificando tabelas criadas..."
    TABLES=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U budget_user -d budget_services -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('employees', 'positions', 'teams', 'employee_salary_history', 'employee_position_history', 'employee_teams');")
    
    if [ -n "\$TABLES" ]; then
        echo "✅ Tabelas encontradas:"
        echo "\$TABLES" | sed 's/^/   - /'
    else
        echo "⚠️  Tabelas não encontradas (pode ser normal se já existirem)"
    fi
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ ERRO AO EXECUTAR MIGRATION"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
else
    echo ""
    echo -e "${RED}❌ Erro ao aplicar migration${NC}"
    exit 1
fi

echo ""


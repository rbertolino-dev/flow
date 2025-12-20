#!/bin/bash

# 🚀 Script: Aplicar Migrations via SSH
# Descrição: Aplica migrations do Supabase no servidor via SSH usando credenciais salvas
# Uso: ./scripts/aplicar-migrations-ssh.sh [--all] [--file nome.sql]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar helper SSH (usa chave ao invés de senha)
source "$SCRIPT_DIR/ssh-helper.sh"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migrations via SSH            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "🖥️  Servidor: $SSH_USER@$SSH_HOST_IP (usando chave SSH)"
echo "📁 Diretório: $SSH_DIR"
echo ""

# Verificar se projeto está linkado no servidor
echo -e "${BLUE}🔍 Verificando configuração no servidor...${NC}"

ssh "$SSH_HOST_ALIAS" << 'ENDSSH'
cd /opt/app

# Carregar configuração Supabase
if [ -f ".supabase-cli-config" ]; then
    source .supabase-cli-config
    echo "✅ Configuração Supabase carregada"
else
    echo "❌ Arquivo .supabase-cli-config não encontrado"
    exit 1
fi

# Verificar se projeto está linkado
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "🔗 Linkando projeto..."
    supabase link --project-ref "$SUPABASE_PROJECT_ID"
fi

echo "✅ Projeto linkado"
ENDSSH

# Aplicar migrations
if [ "$1" = "--all" ]; then
    echo ""
    echo -e "${BLUE}⚡ Aplicando todas as migrations...${NC}"
    
    ssh "$SSH_HOST_ALIAS" << 'ENDSSH'
cd /opt/app
source .supabase-cli-config

echo "📦 Aplicando migrations..."
supabase db push

echo ""
echo "✅ Migrations aplicadas!"
ENDSSH

elif [ "$1" = "--file" ] && [ -n "$2" ]; then
    SQL_FILE="$2"
    
    if [ ! -f "$SQL_FILE" ]; then
        echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}📤 Copiando arquivo para servidor...${NC}"
    ssh_copy "$SQL_FILE"
    
    echo ""
    echo -e "${BLUE}⚡ Executando SQL no servidor...${NC}"
    
    NOME_ARQUIVO=$(basename "$SQL_FILE")
    
    sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SSH_USER@$SSH_HOST" << ENDSSH
cd /opt/app
source .supabase-cli-config

echo "📄 Executando: $NOME_ARQUIVO"
supabase db execute --file "$NOME_ARQUIVO"

echo ""
echo "✅ SQL executado!"
ENDSSH

else
    echo -e "${YELLOW}Uso:${NC}"
    echo "  ./scripts/aplicar-migrations-ssh.sh --all"
    echo "  ./scripts/aplicar-migrations-ssh.sh --file [arquivo.sql]"
    echo ""
    echo "Exemplos:"
    echo "  ./scripts/aplicar-migrations-ssh.sh --all"
    echo "  ./scripts/aplicar-migrations-ssh.sh --file supabase/migrations/20251216000000_create_table.sql"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Operação concluída!${NC}"


#!/bin/bash

# 🔐 Script: Carregar Todas as Credenciais
# Descrição: Carrega credenciais SSH e Supabase automaticamente
# Uso: source ./scripts/carregar-credenciais.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Carregar credenciais SSH
if [ -f "$SCRIPT_DIR/.ssh-credentials" ]; then
    source "$SCRIPT_DIR/.ssh-credentials"
    export SSH_USER SSH_PASSWORD SSH_HOST SSH_DIR
    echo -e "${GREEN}✅ Credenciais SSH carregadas${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo .ssh-credentials não encontrado${NC}"
fi

# Carregar configuração Supabase CLI
if [ -f "$PROJECT_ROOT/.supabase-cli-config" ]; then
    source "$PROJECT_ROOT/.supabase-cli-config"
    export SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_ID SUPABASE_URL
    echo -e "${GREEN}✅ Configuração Supabase CLI carregada${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo .supabase-cli-config não encontrado${NC}"
fi

# Verificar se sshpass está disponível
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}⚠️  sshpass não encontrado (necessário para SSH automatizado)${NC}"
fi


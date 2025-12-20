#!/bin/bash

# 🚀 Script: Quick Deploy - Deploy Rápido com Versionamento
# Descrição: Wrapper simples para deploy com versionamento automático
# Uso: ./scripts/quick-deploy.sh [descrição das mudanças]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/deploy-with-version.sh"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 Quick Deploy - Deploy Rápido${NC}\n"

# Se descrição foi fornecida, usar ela
if [ -n "$1" ]; then
    echo -e "${BLUE}Mudanças:${NC} $1\n"
    "$DEPLOY_SCRIPT" --changes "$1"
else
    # Caso contrário, usar auto-changes
    echo -e "${BLUE}Usando descrição automática do git...${NC}\n"
    "$DEPLOY_SCRIPT" --auto-changes
fi

echo -e "\n${GREEN}✅ Deploy concluído!${NC}"






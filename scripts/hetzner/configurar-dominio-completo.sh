#!/bin/bash

# 🌐 Script: Configurar Domínio Completo (Nginx + SSL)
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
    SUDO="sudo"
else
    SUDO=""
fi

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Configuração Completa de Domínio     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ -z "$1" ]; then
    read -p "🌐 Digite o domínio (ex: app.seudominio.com): " DOMINIO
else
    DOMINIO=$1
fi

if [ -z "$DOMINIO" ]; then
    echo -e "${RED}❌ Domínio não fornecido${NC}"
    exit 1
fi

if [ -z "$2" ]; then
    read -p "📧 Digite o email para SSL (ex: admin@seudominio.com): " EMAIL
else
    EMAIL=$2
fi

if [ -z "$EMAIL" ]; then
    EMAIL="admin@${DOMINIO}"
    echo -e "${YELLOW}⚠️  Usando email padrão: $EMAIL${NC}"
fi

PORTA_APP=${3:-"3000"}

echo ""
echo -e "${GREEN}📋 Configuração:${NC}"
echo "   Domínio: $DOMINIO"
echo "   Email: $EMAIL"
echo "   Porta App: $PORTA_APP"
echo ""
read -p "Continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configurar Nginx
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN} FASE 1: Configurando Nginx${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}\n"

bash "$SCRIPT_DIR/configurar-nginx.sh" "$DOMINIO" "$PORTA_APP"

# Configurar SSL
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN} FASE 2: Configurando SSL${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}\n"

bash "$SCRIPT_DIR/configurar-ssl.sh" "$DOMINIO" "$EMAIL"

echo -e "\n${GREEN}✅ Configuração completa!${NC}"
echo -e "\n${BLUE}🌐 Aplicação disponível em:${NC}"
echo "   https://$DOMINIO"
echo ""




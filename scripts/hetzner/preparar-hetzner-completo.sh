#!/bin/bash

# 🚀 Script Master: Preparar Ambiente Hetzner Completo
# Descrição: Orquestra toda a preparação do servidor Hetzner
# Uso: ./scripts/hetzner/preparar-hetzner-completo.sh [DOMINIO] [EMAIL] [PORTA_APP]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parâmetros
DOMINIO=${1:-""}
EMAIL=${2:-""}
PORTA_APP=${3:-"3000"}

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Preparação Completa do Hetzner        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar se está sendo executado no servidor
if [ ! -f "/etc/os-release" ] || ! grep -q "Ubuntu\|Debian" /etc/os-release 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Este script deve ser executado no servidor Hetzner${NC}"
    echo ""
    read -p "Continuar mesmo assim? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# ============================================
# FASE 1: Preparar Servidor
# ============================================
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN} FASE 1: Preparar Servidor${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}\n"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/preparar-servidor.sh" ]; then
    bash "$SCRIPT_DIR/preparar-servidor.sh"
else
    echo -e "${RED}❌ Script preparar-servidor.sh não encontrado${NC}"
    exit 1
fi

# ============================================
# FASE 2: Configurar Nginx (se domínio fornecido)
# ============================================
if [ -n "$DOMINIO" ]; then
    echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN} FASE 2: Configurar Nginx${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}\n"
    
    if [ -f "$SCRIPT_DIR/configurar-nginx.sh" ]; then
        bash "$SCRIPT_DIR/configurar-nginx.sh" "$DOMINIO" "$PORTA_APP"
    else
        echo -e "${YELLOW}⚠️  Script configurar-nginx.sh não encontrado${NC}"
    fi
    
    # ============================================
    # FASE 3: Configurar SSL (se domínio fornecido)
    # ============================================
    if [ -n "$EMAIL" ]; then
        echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
        echo -e "${GREEN} FASE 3: Configurar SSL${NC}"
        echo -e "${GREEN}═══════════════════════════════════════${NC}\n"
        
        echo -e "${YELLOW}⚠️  IMPORTANTE: Configure o DNS primeiro!${NC}"
        echo "  Tipo: A"
        echo "  Nome: $DOMINIO"
        echo "  Valor: $(curl -s ifconfig.me || echo 'SEU_IP')"
        echo ""
        read -p "DNS já está configurado? (s/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            if [ -f "$SCRIPT_DIR/configurar-ssl.sh" ]; then
                bash "$SCRIPT_DIR/configurar-ssl.sh" "$DOMINIO" "$EMAIL"
            else
                echo -e "${YELLOW}⚠️  Script configurar-ssl.sh não encontrado${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Configure o DNS e depois execute:${NC}"
            echo "  ./scripts/hetzner/configurar-ssl.sh $DOMINIO $EMAIL"
        fi
    else
        echo -e "\n${YELLOW}⚠️  Email não fornecido. Configure SSL depois:${NC}"
        echo "  ./scripts/hetzner/configurar-ssl.sh $DOMINIO seu@email.com"
    fi
else
    echo -e "\n${YELLOW}⚠️  Domínio não fornecido. Configure Nginx depois:${NC}"
    echo "  ./scripts/hetzner/configurar-nginx.sh seu-dominio.com 3000"
fi

# ============================================
# Resumo Final
# ============================================
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Preparação Concluída!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}\n"

echo -e "${BLUE}📋 Próximos passos:${NC}"
echo ""
echo "1. Se ainda não fez, configure o DNS do domínio"
echo "2. Configure SSL (se ainda não fez):"
echo "   ./scripts/hetzner/configurar-ssl.sh $DOMINIO seu@email.com"
echo ""
echo "3. Faça deploy da aplicação:"
echo "   ./scripts/hetzner/deploy-app.sh"
echo ""
echo "4. Configure backup automático:"
echo "   Adicione ao crontab: 0 2 * * * $SCRIPT_DIR/backup-app.sh"
echo ""

echo -e "${BLUE}📚 Scripts disponíveis:${NC}"
echo "  ./scripts/hetzner/preparar-servidor.sh    - Preparar servidor"
echo "  ./scripts/hetzner/configurar-nginx.sh     - Configurar Nginx"
echo "  ./scripts/hetzner/configurar-ssl.sh       - Configurar SSL"
echo "  ./scripts/hetzner/deploy-app.sh           - Deploy da aplicação"
echo "  ./scripts/hetzner/backup-app.sh            - Backup da aplicação"
echo ""

echo -e "${GREEN}🎉 Ambiente Hetzner pronto para uso!${NC}"




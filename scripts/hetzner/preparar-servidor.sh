#!/bin/bash

# 🖥️ Script: Preparar Servidor Hetzner
# Descrição: Instala Docker, configura firewall e dependências básicas
# Uso: Execute no servidor Hetzner como root ou com sudo

set -e

echo "🚀 Iniciando preparação do servidor Hetzner..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se é root ou tem sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  Executando com sudo...${NC}"
    SUDO="sudo"
else
    SUDO=""
fi

# ============================================
# 1. Atualizar Sistema
# ============================================
echo -e "\n${GREEN}📦 Atualizando sistema...${NC}"
$SUDO apt update
$SUDO apt upgrade -y
$SUDO apt install -y curl wget git nano ufw htop fail2ban

# ============================================
# 2. Instalar Docker
# ============================================
echo -e "\n${GREEN}🐳 Instalando Docker...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker já está instalado${NC}"
    docker --version
else
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    $SUDO sh /tmp/get-docker.sh
    rm /tmp/get-docker.sh
    
    # Adicionar usuário ao grupo docker (se não for root)
    if [ "$EUID" -ne 0 ]; then
        $SUDO usermod -aG docker $USER
        echo -e "${YELLOW}⚠️  Você precisa fazer logout e login novamente para usar Docker sem sudo${NC}"
        echo -e "${YELLOW}   Ou execute: newgrp docker${NC}"
    fi
fi

# Verificar instalação
docker --version
docker-compose --version || echo -e "${YELLOW}⚠️  Docker Compose não encontrado, instalando...${NC}"

# ============================================
# 3. Instalar Docker Compose (se necessário)
# ============================================
if ! command -v docker-compose &> /dev/null; then
    echo -e "\n${GREEN}📦 Instalando Docker Compose...${NC}"
    $SUDO apt install -y docker-compose-plugin
fi

# ============================================
# 4. Configurar Firewall
# ============================================
echo -e "\n${GREEN}🔥 Configurando firewall (UFW)...${NC}"

# Permitir SSH (IMPORTANTE: fazer antes de ativar!)
$SUDO ufw allow 22/tcp

# Permitir HTTP/HTTPS
$SUDO ufw allow 80/tcp
$SUDO ufw allow 443/tcp

# Permitir portas comuns para aplicações
# (Ajustar conforme necessário)
$SUDO ufw allow 3000/tcp comment 'Aplicação Node.js (se necessário)'
$SUDO ufw allow 8080/tcp comment 'Aplicação alternativa (se necessário)'

# Ativar firewall
echo -e "${YELLOW}⚠️  Ativando firewall...${NC}"
echo "y" | $SUDO ufw enable

# Mostrar status
$SUDO ufw status verbose

# ============================================
# 5. Configurar Fail2Ban
# ============================================
echo -e "\n${GREEN}🛡️  Configurando Fail2Ban...${NC}"
$SUDO systemctl enable fail2ban
$SUDO systemctl start fail2ban
$SUDO systemctl status fail2ban --no-pager | head -5

# ============================================
# 6. Criar diretórios necessários
# ============================================
echo -e "\n${GREEN}📁 Criando diretórios...${NC}"
$SUDO mkdir -p /opt/app
$SUDO mkdir -p /opt/backups
$SUDO mkdir -p /opt/logs
$SUDO chown -R $USER:$USER /opt/app 2>/dev/null || true
$SUDO chown -R $USER:$USER /opt/backups 2>/dev/null || true
$SUDO chown -R $USER:$USER /opt/logs 2>/dev/null || true

# ============================================
# 7. Verificar recursos do sistema
# ============================================
echo -e "\n${GREEN}💻 Informações do sistema:${NC}"
echo "CPU: $(nproc) cores"
echo "RAM: $(free -h | awk '/^Mem:/ {print $2}')"
echo "Disco:"
df -h / | tail -1

# ============================================
# 8. Resumo
# ============================================
echo -e "\n${GREEN}✅ Preparação do servidor concluída!${NC}"
echo -e "\n${YELLOW}📋 Próximos passos:${NC}"
echo "1. Se não for root, faça logout/login para usar Docker sem sudo"
echo "2. Configure Nginx: ./scripts/hetzner/configurar-nginx.sh"
echo "3. Configure SSL: ./scripts/hetzner/configurar-ssl.sh"
echo "4. Faça deploy da aplicação: ./scripts/hetzner/deploy-app.sh"
echo ""
echo -e "${GREEN}🔍 Verificar instalações:${NC}"
echo "  docker --version"
echo "  docker-compose --version"
echo "  sudo ufw status"
echo "  sudo systemctl status fail2ban"




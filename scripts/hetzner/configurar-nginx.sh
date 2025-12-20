#!/bin/bash

# 🌐 Script: Configurar Nginx como Reverse Proxy
# Descrição: Configura Nginx para servir aplicação com SSL
# Uso: ./scripts/hetzner/configurar-nginx.sh [DOMINIO] [PORTA_APP]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se é root ou tem sudo
if [ "$EUID" -ne 0 ]; then 
    SUDO="sudo"
else
    SUDO=""
fi

# Parâmetros
DOMINIO=${1:-""}
PORTA_APP=${2:-"3000"}

if [ -z "$DOMINIO" ]; then
    echo -e "${RED}❌ Erro: Domínio não fornecido${NC}"
    echo "Uso: $0 <dominio> [porta_app]"
    echo "Exemplo: $0 app.seudominio.com 3000"
    exit 1
fi

echo -e "${GREEN}🌐 Configurando Nginx para $DOMINIO...${NC}"

# ============================================
# 1. Instalar Nginx
# ============================================
if ! command -v nginx &> /dev/null; then
    echo "Instalando Nginx..."
    $SUDO apt update
    $SUDO apt install -y nginx
else
    echo -e "${YELLOW}⚠️  Nginx já está instalado${NC}"
fi

# ============================================
# 2. Criar configuração do site
# ============================================
CONFIG_FILE="/etc/nginx/sites-available/$DOMINIO"

echo -e "\n${GREEN}📝 Criando configuração do Nginx...${NC}"

$SUDO tee "$CONFIG_FILE" > /dev/null <<EOF
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMINIO;

    # Para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirecionar todo o resto para HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# Configuração HTTPS (será habilitada após SSL)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name $DOMINIO;
#     ...
# }

    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logs
    access_log /var/log/nginx/${DOMINIO}-access.log;
    error_log /var/log/nginx/${DOMINIO}-error.log;

    # Tamanho máximo de upload
    client_max_body_size 50M;

    # Proxy para aplicação
    location / {
        proxy_pass http://localhost:${PORTA_APP};
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# ============================================
# 3. Habilitar site
# ============================================
echo -e "\n${GREEN}🔗 Habilitando site...${NC}"
$SUDO ln -sf "$CONFIG_FILE" "/etc/nginx/sites-enabled/$DOMINIO"

# Remover site padrão se existir
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "Removendo site padrão..."
    $SUDO rm /etc/nginx/sites-enabled/default
fi

# ============================================
# 4. Testar configuração
# ============================================
echo -e "\n${GREEN}🧪 Testando configuração do Nginx...${NC}"
if $SUDO nginx -t; then
    echo -e "${GREEN}✅ Configuração válida!${NC}"
else
    echo -e "${RED}❌ Erro na configuração do Nginx${NC}"
    exit 1
fi

# ============================================
# 5. Recarregar Nginx
# ============================================
echo -e "\n${GREEN}🔄 Recarregando Nginx...${NC}"
$SUDO systemctl reload nginx
$SUDO systemctl enable nginx

# ============================================
# 6. Verificar status
# ============================================
echo -e "\n${GREEN}📊 Status do Nginx:${NC}"
$SUDO systemctl status nginx --no-pager | head -10

echo -e "\n${GREEN}✅ Nginx configurado com sucesso!${NC}"
echo -e "\n${YELLOW}📋 Próximo passo:${NC}"
echo "Configure SSL com: ./scripts/hetzner/configurar-ssl.sh $DOMINIO"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "1. Configure o DNS do domínio $DOMINIO para apontar para este servidor"
echo "2. Aguarde a propagação do DNS (pode levar alguns minutos)"
echo "3. Depois configure o SSL"




#!/bin/bash

# 🔒 Script: Configurar SSL com Let's Encrypt
# Descrição: Configura certificado SSL gratuito via Certbot
# Uso: ./scripts/hetzner/configurar-ssl.sh [DOMINIO] [EMAIL]

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
EMAIL=${2:-""}

if [ -z "$DOMINIO" ]; then
    echo -e "${RED}❌ Erro: Domínio não fornecido${NC}"
    echo "Uso: $0 <dominio> [email]"
    echo "Exemplo: $0 app.seudominio.com admin@seudominio.com"
    exit 1
fi

# Se email não fornecido, usar genérico ou pedir
if [ -z "$EMAIL" ]; then
    # Tentar extrair domínio base do subdomínio
    DOMINIO_BASE=$(echo $DOMINIO | sed 's/^[^.]*\.//')
    EMAIL="admin@${DOMINIO_BASE}"
    echo -e "${YELLOW}⚠️  Email não fornecido, usando: $EMAIL${NC}"
    echo -e "${YELLOW}   (Este email não precisa existir, é apenas para notificações do Let's Encrypt)${NC}"
fi

echo -e "${GREEN}🔒 Configurando SSL para $DOMINIO...${NC}"

# ============================================
# 1. Verificar se DNS está configurado
# ============================================
echo -e "\n${YELLOW}🔍 Verificando DNS...${NC}"
SERVER_IP=$(curl -4 -s ifconfig.me || curl -s ipinfo.io/ip)
DNS_IP=$(dig +short $DOMINIO | tail -1)

if [ -z "$DNS_IP" ]; then
    echo -e "${RED}❌ Erro: Não foi possível resolver $DOMINIO${NC}"
    echo "Configure o DNS primeiro:"
    echo "  Tipo: A"
    echo "  Nome: $DOMINIO"
    echo "  Valor: $SERVER_IP"
    exit 1
fi

if [ "$DNS_IP" != "$SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  Aviso: DNS não aponta para este servidor${NC}"
    echo "  DNS aponta para: $DNS_IP"
    echo "  Este servidor: $SERVER_IP"
    echo ""
    read -p "Continuar mesmo assim? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# ============================================
# 2. Instalar Certbot
# ============================================
if ! command -v certbot &> /dev/null; then
    echo -e "\n${GREEN}📦 Instalando Certbot...${NC}"
    $SUDO apt update
    $SUDO apt install -y certbot python3-certbot-nginx
else
    echo -e "${YELLOW}⚠️  Certbot já está instalado${NC}"
fi

# ============================================
# 3. Obter certificado SSL
# ============================================
echo -e "\n${GREEN}🔐 Obtendo certificado SSL...${NC}"

# Verificar se certificado já existe
if [ -d "/etc/letsencrypt/live/$DOMINIO" ]; then
    echo -e "${YELLOW}⚠️  Certificado já existe para $DOMINIO${NC}"
    read -p "Renovar certificado? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        $SUDO certbot renew --cert-name $DOMINIO
    else
        echo "Usando certificado existente"
    fi
else
    # Obter novo certificado
    echo "Executando Certbot..."
    $SUDO certbot --nginx -d $DOMINIO --non-interactive --agree-tos --email $EMAIL --redirect
fi

# ============================================
# 4. Verificar certificado
# ============================================
echo -e "\n${GREEN}✅ Verificando certificado...${NC}"
$SUDO certbot certificates | grep -A 5 "$DOMINIO" || echo -e "${YELLOW}⚠️  Certificado não encontrado na lista${NC}"

# ============================================
# 5. Configurar renovação automática
# ============================================
echo -e "\n${GREEN}🔄 Configurando renovação automática...${NC}"

# Verificar se já existe no crontab
if ! $SUDO crontab -l 2>/dev/null | grep -q "certbot renew"; then
    echo "Adicionando renovação automática ao crontab..."
    ($SUDO crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | $SUDO crontab -
    echo -e "${GREEN}✅ Renovação automática configurada${NC}"
else
    echo -e "${YELLOW}⚠️  Renovação automática já está configurada${NC}"
fi

# ============================================
# 6. Testar renovação
# ============================================
echo -e "\n${GREEN}🧪 Testando renovação (dry-run)...${NC}"
$SUDO certbot renew --dry-run

# ============================================
# 7. Recarregar Nginx
# ============================================
echo -e "\n${GREEN}🔄 Recarregando Nginx...${NC}"
$SUDO systemctl reload nginx

# ============================================
# 8. Resumo
# ============================================
echo -e "\n${GREEN}✅ SSL configurado com sucesso!${NC}"
echo -e "\n${GREEN}🔍 Verificar certificado:${NC}"
echo "  sudo certbot certificates"
echo ""
echo -e "${GREEN}🌐 Testar HTTPS:${NC}"
echo "  curl -I https://$DOMINIO"
echo ""
echo -e "${GREEN}📋 Informações:${NC}"
echo "  Certificado: /etc/letsencrypt/live/$DOMINIO/"
echo "  Renovação automática: Configurada (diariamente às 3h)"
echo "  Validade: 90 dias (renovado automaticamente)"




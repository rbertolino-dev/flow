#!/bin/bash

# 🔍 Script: Verificar Configuração DNS no Registro.br
# Verifica se o DNS está configurado corretamente e propagando

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Verificação de DNS - Registro.br     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Solicitar domínio
if [ -z "$1" ]; then
    read -p "🌐 Digite o domínio configurado (ex: app.seudominio.com.br): " DOMINIO
else
    DOMINIO=$1
fi

if [ -z "$DOMINIO" ]; then
    echo -e "${RED}❌ Domínio não fornecido${NC}"
    exit 1
fi

# Solicitar IP esperado
if [ -z "$2" ]; then
    read -p "🖥️  Digite o IP público do servidor Hetzner: " IP_ESPERADO
else
    IP_ESPERADO=$2
fi

if [ -z "$IP_ESPERADO" ]; then
    echo -e "${YELLOW}⚠️  IP não fornecido, vou tentar detectar automaticamente...${NC}"
    IP_ESPERADO=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "")
fi

echo ""
echo -e "${GREEN}📋 Verificando:${NC}"
echo "   Domínio: $DOMINIO"
echo "   IP Esperado: $IP_ESPERADO"
echo ""

# Verificar se dig/nslookup está instalado
if ! command -v dig &> /dev/null && ! command -v nslookup &> /dev/null; then
    echo -e "${YELLOW}⚠️  dig/nslookup não encontrado. Instalando...${NC}"
    sudo apt update && sudo apt install -y dnsutils
fi

# Verificar DNS
echo -e "${BLUE}🔍 Verificando DNS...${NC}"
echo ""

# Tentar com dig
if command -v dig &> /dev/null; then
    DNS_IP=$(dig +short "$DOMINIO" A | tail -1 | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || echo "")
    
    if [ -n "$DNS_IP" ]; then
        echo -e "${GREEN}✅ DNS encontrado via dig:${NC}"
        echo "   IP Resolvido: $DNS_IP"
        
        if [ -n "$IP_ESPERADO" ] && [ "$DNS_IP" = "$IP_ESPERADO" ]; then
            echo -e "${GREEN}✅ DNS está apontando corretamente para o IP do servidor!${NC}"
            STATUS="OK"
        elif [ -n "$IP_ESPERADO" ]; then
            echo -e "${YELLOW}⚠️  DNS aponta para IP diferente:${NC}"
            echo "   Esperado: $IP_ESPERADO"
            echo "   Encontrado: $DNS_IP"
            echo ""
            echo -e "${YELLOW}   Isso pode ser normal se:${NC}"
            echo "   - DNS ainda está propagando (aguarde 1-2 horas)"
            echo "   - Você configurou um IP diferente"
            STATUS="DIFERENTE"
        else
            echo -e "${GREEN}✅ DNS está configurado e resolvendo!${NC}"
            STATUS="OK"
        fi
    else
        echo -e "${RED}❌ Não foi possível resolver o DNS${NC}"
        STATUS="ERRO"
    fi
fi

# Tentar com nslookup como fallback
if [ "$STATUS" = "ERRO" ] && command -v nslookup &> /dev/null; then
    echo ""
    echo -e "${YELLOW}🔄 Tentando com nslookup...${NC}"
    DNS_IP=$(nslookup "$DOMINIO" | grep -A 1 "Name:" | grep "Address:" | awk '{print $2}' | head -1 || echo "")
    
    if [ -n "$DNS_IP" ]; then
        echo -e "${GREEN}✅ DNS encontrado via nslookup:${NC}"
        echo "   IP Resolvido: $DNS_IP"
        STATUS="OK"
    fi
fi

# Verificar propagação global
echo ""
echo -e "${BLUE}🌍 Verificando propagação global...${NC}"
echo ""

# Verificar múltiplos servidores DNS
DNS_SERVERS=(
    "8.8.8.8"      # Google
    "1.1.1.1"      # Cloudflare
    "208.67.222.222" # OpenDNS
)

PROPAGADO=0
TOTAL=${#DNS_SERVERS[@]}

for DNS_SERVER in "${DNS_SERVERS[@]}"; do
    if command -v dig &> /dev/null; then
        RESULTADO=$(dig @"$DNS_SERVER" +short "$DOMINIO" A 2>/dev/null | tail -1 | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || echo "")
        if [ -n "$RESULTADO" ]; then
            PROPAGADO=$((PROPAGADO + 1))
            echo -e "${GREEN}✅ $DNS_SERVER: $RESULTADO${NC}"
        else
            echo -e "${YELLOW}⏳ $DNS_SERVER: Ainda propagando...${NC}"
        fi
    fi
done

echo ""
echo -e "${BLUE}📊 Propagação: $PROPAGADO/$TOTAL servidores DNS${NC}"

if [ $PROPAGADO -eq $TOTAL ]; then
    echo -e "${GREEN}✅ DNS totalmente propagado!${NC}"
elif [ $PROPAGADO -gt 0 ]; then
    echo -e "${YELLOW}⏳ DNS parcialmente propagado (normal nas primeiras horas)${NC}"
else
    echo -e "${RED}❌ DNS ainda não propagou${NC}"
fi

# Verificar conectividade HTTP
echo ""
echo -e "${BLUE}🌐 Testando conectividade HTTP...${NC}"

if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$DOMINIO" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        echo -e "${GREEN}✅ HTTP respondendo (código: $HTTP_CODE)${NC}"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo -e "${YELLOW}⏳ HTTP não está respondendo ainda${NC}"
        echo "   Isso é normal se:"
        echo "   - DNS ainda está propagando"
        echo "   - Servidor ainda não está configurado"
    else
        echo -e "${YELLOW}⚠️  HTTP retornou código: $HTTP_CODE${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  curl não encontrado, pulando teste HTTP${NC}"
fi

# Resumo final
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  RESUMO DA VERIFICAÇÃO                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$STATUS" = "OK" ] && [ $PROPAGADO -eq $TOTAL ]; then
    echo -e "${GREEN}✅ TUDO CERTO!${NC}"
    echo ""
    echo "✅ DNS configurado corretamente"
    echo "✅ DNS propagado globalmente"
    echo ""
    echo -e "${BLUE}📝 Próximos passos:${NC}"
    echo "   1. Configurar Nginx no servidor Hetzner"
    echo "   2. Configurar SSL com Certbot"
    echo "   3. Testar acesso ao domínio"
elif [ "$STATUS" = "OK" ]; then
    echo -e "${YELLOW}⏳ QUASE LÁ!${NC}"
    echo ""
    echo "✅ DNS configurado corretamente"
    echo "⏳ DNS ainda propagando (normal nas primeiras horas)"
    echo ""
    echo -e "${BLUE}📝 Aguarde 1-2 horas e execute novamente${NC}"
elif [ "$STATUS" = "DIFERENTE" ]; then
    echo -e "${YELLOW}⚠️  ATENÇÃO${NC}"
    echo ""
    echo "⚠️  DNS aponta para IP diferente do esperado"
    echo ""
    echo -e "${BLUE}📝 Verifique:${NC}"
    echo "   1. Se o IP no registro.br está correto"
    echo "   2. Se o DNS ainda está propagando"
    echo "   3. Se você configurou um IP diferente intencionalmente"
else
    echo -e "${RED}❌ PROBLEMA ENCONTRADO${NC}"
    echo ""
    echo "❌ DNS não está resolvendo"
    echo ""
    echo -e "${BLUE}📝 Verifique:${NC}"
    echo "   1. Se o registro foi salvo no registro.br"
    echo "   2. Se o tipo de registro está correto (A)"
    echo "   3. Se o valor (IP) está correto"
    echo "   4. Aguarde 1-2 horas para propagação"
fi

echo ""




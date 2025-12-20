#!/bin/bash

# ============================================
# Script: Corrigir Nginx para React Router
# ============================================
# Adiciona configuração para funcionar com rotas React (SPA)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Corrigir Nginx para React Router (SPA)             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    SUDO="sudo"
else
    SUDO=""
fi

# Encontrar arquivo de configuração
CONFIG_FILES=(
    "/etc/nginx/sites-available/agilizeflow.com.br"
    "/etc/nginx/sites-available/agilizeflow"
    "/etc/nginx/sites-available/default"
)

CONFIG_FILE=""
for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        CONFIG_FILE="$file"
        break
    fi
done

if [ -z "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Arquivo de configuração não encontrado${NC}"
    echo "   Procurando em:"
    for file in "${CONFIG_FILES[@]}"; do
        echo "   - $file"
    done
    exit 1
fi

echo -e "${GREEN}✅ Arquivo encontrado: $CONFIG_FILE${NC}"
echo ""

# Backup
BACKUP_FILE="${CONFIG_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
$SUDO cp "$CONFIG_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
echo ""

# Verificar se usa proxy_pass
if grep -q "proxy_pass" "$CONFIG_FILE"; then
    echo -e "${YELLOW}ℹ️  Configuração usa proxy_pass (aplicação em porta)${NC}"
    echo ""
    echo -e "${BLUE}📋 Verificando configuração do proxy...${NC}"
    
    # Verificar se já tem configuração para SPA
    if grep -q "proxy_redirect" "$CONFIG_FILE" || grep -q "proxy_set_header.*X-Forwarded" "$CONFIG_FILE"; then
        echo -e "${GREEN}✅ Headers de proxy já configurados${NC}"
    else
        echo -e "${YELLOW}⚠️  Pode precisar de headers adicionais${NC}"
    fi
    
    # Verificar se location / está correto
    if grep -A 10 "location / {" "$CONFIG_FILE" | grep -q "proxy_pass"; then
        echo -e "${GREEN}✅ Proxy configurado corretamente${NC}"
        echo ""
        echo -e "${YELLOW}💡 Se ainda der 404, verifique:${NC}"
        echo "   1. A aplicação está rodando na porta configurada?"
        echo "   2. A aplicação React está configurada com base: '/' no router?"
        echo "   3. O Docker container está rodando?"
    fi
else
    echo -e "${YELLOW}ℹ️  Configuração serve arquivos estáticos${NC}"
    echo ""
    
    # Verificar se tem try_files
    if grep -q "try_files.*index.html" "$CONFIG_FILE"; then
        echo -e "${GREEN}✅ Configuração try_files já existe${NC}"
        
        if grep -q "try_files \$uri \$uri/ /index.html" "$CONFIG_FILE"; then
            echo -e "${GREEN}✅ Configuração está correta!${NC}"
        else
            echo -e "${YELLOW}⚠️  Verifique se está: try_files \$uri \$uri/ /index.html;${NC}"
        fi
    else
        echo -e "${YELLOW}🔧 Adicionando configuração try_files...${NC}"
        
        # Adicionar try_files no location /
        $SUDO sed -i '/location \/ {/a\        try_files $uri $uri/ /index.html;' "$CONFIG_FILE"
        
        echo -e "${GREEN}✅ Configuração adicionada!${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}🔍 Testando configuração...${NC}"
if $SUDO nginx -t 2>&1; then
    echo -e "${GREEN}✅ Configuração está correta!${NC}"
    echo ""
    read -p "Recarregar nginx agora? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        $SUDO systemctl reload nginx
        echo -e "${GREEN}✅ Nginx recarregado!${NC}"
        echo ""
        echo -e "${BLUE}🌐 Teste agora: https://agilizeflow.com.br/onboarding${NC}"
    else
        echo -e "${YELLOW}⚠️  Execute manualmente: sudo systemctl reload nginx${NC}"
    fi
else
    echo -e "${RED}❌ Erro na configuração!${NC}"
    echo "   Restaurando backup..."
    $SUDO cp "$BACKUP_FILE" "$CONFIG_FILE"
    echo -e "${YELLOW}⚠️  Backup restaurado. Verifique o arquivo manualmente.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📄 Arquivo: $CONFIG_FILE${NC}"
echo -e "${BLUE}💾 Backup: $BACKUP_FILE${NC}"


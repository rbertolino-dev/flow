#!/bin/bash

# 🔧 Script: Aplicar Correção Nginx para React SPA
# Corrige erro 404 adicionando try_files ou verificando proxy

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Corrigir Nginx - Erro 404            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

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
    echo ""
    echo "Arquivos procurados:"
    for file in "${CONFIG_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Crie um arquivo de configuração primeiro ou informe o caminho:"
    read -p "Caminho do arquivo de configuração: " CONFIG_FILE
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}❌ Arquivo não existe${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Arquivo encontrado: $CONFIG_FILE${NC}"
echo ""

# Backup
BACKUP_FILE="${CONFIG_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
$SUDO cp "$CONFIG_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
echo ""

# Verificar se usa proxy_pass ou root
USES_PROXY=$(grep -c "proxy_pass" "$CONFIG_FILE" || echo "0")
USES_ROOT=$(grep -c "root.*dist\|root.*build" "$CONFIG_FILE" || echo "0")

echo -e "${YELLOW}🔍 Analisando configuração...${NC}"

if [ "$USES_PROXY" -gt 0 ]; then
    echo -e "${BLUE}📡 Configuração: Proxy para aplicação em porta${NC}"
    echo ""
    
    # Verificar se aplicação está rodando
    echo -e "${YELLOW}🔍 Verificando se aplicação está rodando...${NC}"
    
    # Tentar detectar porta do proxy_pass
    PORTA=$(grep "proxy_pass" "$CONFIG_FILE" | grep -o "localhost:[0-9]*" | cut -d: -f2 | head -1 || echo "3000")
    echo "   Porta detectada: $PORTA"
    
    if netstat -tlnp 2>/dev/null | grep -q ":$PORTA " || ss -tlnp 2>/dev/null | grep -q ":$PORTA "; then
        echo -e "${GREEN}✅ Aplicação está rodando na porta $PORTA${NC}"
    else
        echo -e "${RED}❌ Aplicação NÃO está rodando na porta $PORTA${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  SOLUÇÃO:${NC}"
        echo "   1. Iniciar aplicação na porta $PORTA"
        echo "   2. OU verificar se porta está correta no nginx"
        exit 1
    fi
    
    # Verificar se proxy está configurado corretamente
    if ! grep -q "proxy_set_header Host" "$CONFIG_FILE"; then
        echo -e "${YELLOW}⚠️  Adicionando headers do proxy...${NC}"
        # Adicionar headers após proxy_pass
        $SUDO sed -i '/proxy_pass/a\        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;' "$CONFIG_FILE"
    fi
    
elif [ "$USES_ROOT" -gt 0 ]; then
    echo -e "${BLUE}📁 Configuração: Arquivos estáticos (build)${NC}"
    echo ""
    
    # Verificar se tem try_files
    if grep -q "try_files.*index.html" "$CONFIG_FILE"; then
        echo -e "${GREEN}✅ try_files já está configurado${NC}"
    else
        echo -e "${YELLOW}⚠️  Adicionando try_files para SPA...${NC}"
        
        # Adicionar try_files no location /
        if grep -q "location / {" "$CONFIG_FILE"; then
            $SUDO sed -i '/location \/ {/a\        try_files $uri $uri/ /index.html;' "$CONFIG_FILE"
            echo -e "${GREEN}✅ try_files adicionado!${NC}"
        else
            echo -e "${RED}❌ Não encontrou 'location / {' no arquivo${NC}"
            echo "   Adicione manualmente:"
            echo "   location / {"
            echo "       try_files \$uri \$uri/ /index.html;"
            echo "   }"
        fi
    fi
    
    # Verificar se pasta existe
    ROOT_PATH=$(grep "^[[:space:]]*root" "$CONFIG_FILE" | head -1 | awk '{print $2}' | sed 's/;//' || echo "")
    if [ -n "$ROOT_PATH" ]; then
        echo "   Pasta configurada: $ROOT_PATH"
        if [ -d "$ROOT_PATH" ]; then
            if [ -f "$ROOT_PATH/index.html" ]; then
                echo -e "${GREEN}✅ Pasta existe e tem index.html${NC}"
            else
                echo -e "${YELLOW}⚠️  Pasta existe mas index.html não encontrado${NC}"
            fi
        else
            echo -e "${RED}❌ Pasta não existe: $ROOT_PATH${NC}"
            echo "   Verifique o caminho ou faça build da aplicação"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Não detectou proxy_pass nem root${NC}"
    echo "   Verificando configuração manualmente..."
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
        echo -e "${BLUE}🌐 Teste agora: http://agilizeflow.com.br/cadastro${NC}"
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
echo ""
echo -e "${BLUE}📋 Se ainda não funcionar:${NC}"
echo "   1. Verificar se aplicação está rodando (se usar proxy)"
echo "   2. Verificar se build existe (se usar arquivos estáticos)"
echo "   3. Verificar logs: sudo tail -f /var/log/nginx/error.log"




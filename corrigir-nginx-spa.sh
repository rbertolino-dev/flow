#!/bin/bash

# 🔧 Script: Corrigir Nginx para React SPA
# Adiciona configuração try_files para funcionar com rotas React

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Corrigir Nginx para React SPA        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    SUDO="sudo"
else
    SUDO=""
fi

# Encontrar arquivo de configuração
CONFIG_FILES=(
    "/etc/nginx/sites-available/agilizeflow"
    "/etc/nginx/sites-available/agilizeflow.com.br"
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

# Verificar se já tem try_files
if grep -q "try_files.*index.html" "$CONFIG_FILE"; then
    echo -e "${YELLOW}⚠️  Configuração try_files já existe${NC}"
    echo "   Verificando se está correta..."
    
    if grep -q "try_files \$uri \$uri/ /index.html" "$CONFIG_FILE"; then
        echo -e "${GREEN}✅ Configuração está correta!${NC}"
    else
        echo -e "${YELLOW}⚠️  Configuração pode estar incorreta${NC}"
    fi
else
    echo -e "${YELLOW}🔧 Adicionando configuração try_files...${NC}"
    
    # Criar arquivo temporário com a correção
    TEMP_FILE=$(mktemp)
    
    # Processar arquivo linha por linha
    IN_LOCATION=0
    while IFS= read -r line; do
        echo "$line" >> "$TEMP_FILE"
        
        # Detectar início de location /
        if echo "$line" | grep -q "location / {"; then
            IN_LOCATION=1
        fi
        
        # Adicionar try_files após location / {
        if [ $IN_LOCATION -eq 1 ] && echo "$line" | grep -q "{"; then
            echo "        try_files \$uri \$uri/ /index.html;" >> "$TEMP_FILE"
            IN_LOCATION=0
        fi
        
        # Resetar se encontrar }
        if echo "$line" | grep -q "^[[:space:]]*}[[:space:]]*$"; then
            IN_LOCATION=0
        fi
    done < "$CONFIG_FILE"
    
    # Aplicar mudanças
    $SUDO mv "$TEMP_FILE" "$CONFIG_FILE"
    $SUDO chmod 644 "$CONFIG_FILE"
    
    echo -e "${GREEN}✅ Configuração adicionada!${NC}"
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
echo -e "${BLUE}📋 Configuração aplicada:${NC}"
echo "   try_files \$uri \$uri/ /index.html;"
echo ""
echo -e "${BLUE}📄 Arquivo: $CONFIG_FILE${NC}"
echo -e "${BLUE}💾 Backup: $BACKUP_FILE${NC}"




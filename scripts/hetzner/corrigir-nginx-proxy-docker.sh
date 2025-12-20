#!/bin/bash

# ============================================
# Script: Corrigir Nginx para fazer proxy para Docker
# ============================================
# Corrige configuração do Nginx para fazer proxy para aplicação React no Docker

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Corrigir Nginx - Proxy para Docker (React)        ║${NC}"
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
    exit 1
fi

echo -e "${GREEN}✅ Arquivo encontrado: $CONFIG_FILE${NC}"
echo ""

# Backup
BACKUP_FILE="${CONFIG_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
$SUDO cp "$CONFIG_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
echo ""

# Verificar porta do Docker
PORTA_DOCKER="3000"
if docker ps --format "{{.Names}}\t{{.Ports}}" | grep -q "kanban-buzz-app"; then
    PORTA_INFO=$(docker ps --format "{{.Names}}\t{{.Ports}}" | grep "kanban-buzz-app")
    if echo "$PORTA_INFO" | grep -q "3000:80"; then
        PORTA_DOCKER="3000"
        echo -e "${GREEN}✅ Container Docker encontrado na porta 3000${NC}"
    else
        echo -e "${YELLOW}⚠️  Container encontrado, mas porta pode ser diferente${NC}"
        echo "   Portas: $PORTA_INFO"
    fi
else
    echo -e "${YELLOW}⚠️  Container Docker não encontrado${NC}"
    echo "   Usando porta padrão: 3000"
fi

echo ""

# Verificar se já usa proxy_pass
if grep -q "proxy_pass.*localhost:${PORTA_DOCKER}" "$CONFIG_FILE"; then
    echo -e "${GREEN}✅ Proxy já configurado para localhost:${PORTA_DOCKER}${NC}"
    echo ""
    echo -e "${YELLOW}🔍 Verificando se está correto...${NC}"
    
    # Verificar se tem todos os headers necessários
    if grep -q "proxy_set_header Host" "$CONFIG_FILE" && \
       grep -q "proxy_set_header X-Real-IP" "$CONFIG_FILE" && \
       grep -q "proxy_set_header X-Forwarded" "$CONFIG_FILE"; then
        echo -e "${GREEN}✅ Headers de proxy configurados corretamente${NC}"
    else
        echo -e "${YELLOW}⚠️  Alguns headers podem estar faltando${NC}"
    fi
else
    echo -e "${YELLOW}🔧 Configurando proxy para Docker...${NC}"
    
    # Criar configuração temporária
    TEMP_FILE=$(mktemp)
    
    # Processar arquivo
    IN_LOCATION=0
    LOCATION_MODIFIED=0
    
    while IFS= read -r line; do
        # Detectar início de location /
        if echo "$line" | grep -q "^[[:space:]]*location / {"; then
            IN_LOCATION=1
            echo "$line" >> "$TEMP_FILE"
            # Adicionar configuração de proxy
            cat >> "$TEMP_FILE" << EOF
        proxy_pass http://localhost:${PORTA_DOCKER};
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
        
        # Buffer settings para evitar 502
        proxy_buffering off;
        proxy_request_buffering off;
EOF
            LOCATION_MODIFIED=1
            IN_LOCATION=0
            continue
        fi
        
        # Se está dentro de location / e ainda não modificou, substituir
        if [ $IN_LOCATION -eq 1 ] && [ $LOCATION_MODIFIED -eq 0 ]; then
            # Pular linhas antigas de location /
            if echo "$line" | grep -qE "^(root|index|try_files)"; then
                continue
            fi
        fi
        
        # Resetar se encontrar }
        if echo "$line" | grep -qE "^[[:space:]]*}[[:space:]]*$" && [ $IN_LOCATION -eq 1 ]; then
            IN_LOCATION=0
        fi
        
        echo "$line" >> "$TEMP_FILE"
    done < "$CONFIG_FILE"
    
    # Aplicar mudanças
    $SUDO mv "$TEMP_FILE" "$CONFIG_FILE"
    $SUDO chmod 644 "$CONFIG_FILE"
    
    echo -e "${GREEN}✅ Configuração de proxy adicionada!${NC}"
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
        echo ""
        echo -e "${YELLOW}💡 Verifique se o container Docker está rodando:${NC}"
        echo "   docker ps | grep kanban-buzz-app"
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


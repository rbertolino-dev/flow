#!/bin/bash

# 🔧 Script: Corrigir Nginx no Hetzner via SSH
# Acessa servidor Hetzner e corrige configuração do nginx

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Corrigir Nginx no Hetzner            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Configurações
SERVER_IP="95.217.2.116"
DOMINIO="agilizeflow.com.br"
SSH_USER="root"
# OU se usar outro usuário:
# SSH_USER="usuario"

echo -e "${YELLOW}🔍 Configurações:${NC}"
echo "   Servidor: $SERVER_IP"
echo "   Domínio: $DOMINIO"
echo "   Usuário SSH: $SSH_USER"
echo ""

# Verificar se pode conectar
echo -e "${YELLOW}🔍 Verificando conexão...${NC}"
if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$SSH_USER@$SERVER_IP" "echo 'Conectado'" 2>/dev/null; then
    echo -e "${RED}❌ Não foi possível conectar via SSH${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Possíveis causas:${NC}"
    echo "   1. Chave SSH não configurada"
    echo "   2. Senha necessária (não configurada)"
    echo "   3. Firewall bloqueando SSH"
    echo ""
    echo -e "${BLUE}📋 Execute manualmente no servidor:${NC}"
    echo "   ssh $SSH_USER@$SERVER_IP"
    echo "   ./APLICAR-CORRECAO-NGINX.sh"
    exit 1
fi

echo -e "${GREEN}✅ Conectado ao servidor!${NC}"
echo ""

# Executar correção remota
echo -e "${YELLOW}🔧 Aplicando correção no nginx...${NC}"

ssh "$SSH_USER@$SERVER_IP" << 'ENDSSH'
set -e

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
    echo "❌ Arquivo de configuração não encontrado"
    exit 1
fi

echo "✅ Arquivo encontrado: $CONFIG_FILE"

# Backup
BACKUP_FILE="${CONFIG_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "✅ Backup criado: $BACKUP_FILE"

# Verificar se usa proxy ou arquivos estáticos
if grep -q "proxy_pass" "$CONFIG_FILE"; then
    echo "📡 Configuração: Proxy (aplicação em porta)"
    
    # Verificar porta
    PORTA=$(grep "proxy_pass" "$CONFIG_FILE" | grep -o "localhost:[0-9]*" | cut -d: -f2 | head -1 || echo "3000")
    echo "   Porta: $PORTA"
    
    # Verificar se aplicação está rodando
    if netstat -tlnp 2>/dev/null | grep -q ":$PORTA " || ss -tlnp 2>/dev/null | grep -q ":$PORTA "; then
        echo "✅ Aplicação está rodando"
    else
        echo "⚠️  Aplicação NÃO está rodando na porta $PORTA"
        echo "   Inicie a aplicação primeiro"
    fi
    
elif grep -q "root.*dist\|root.*build" "$CONFIG_FILE"; then
    echo "📁 Configuração: Arquivos estáticos (build)"
    
    # Verificar se tem try_files
    if grep -q "try_files.*index.html" "$CONFIG_FILE"; then
        echo "✅ try_files já configurado"
    else
        echo "⚠️  Adicionando try_files..."
        
        # Adicionar try_files
        if grep -q "location / {" "$CONFIG_FILE"; then
            sed -i '/location \/ {/a\        try_files $uri $uri/ /index.html;' "$CONFIG_FILE"
            echo "✅ try_files adicionado!"
        fi
    fi
else
    echo "⚠️  Adicionando try_files padrão..."
    
    # Adicionar location / com try_files se não existir
    if ! grep -q "location / {" "$CONFIG_FILE"; then
        # Adicionar antes do último }
        sed -i '$ i\    location / {\n        try_files $uri $uri/ /index.html;\n    }' "$CONFIG_FILE"
    else
        # Adicionar try_files no location existente
        sed -i '/location \/ {/a\        try_files $uri $uri/ /index.html;' "$CONFIG_FILE"
    fi
fi

# Testar configuração
echo ""
echo "🔍 Testando configuração..."
if nginx -t 2>&1; then
    echo "✅ Configuração válida!"
    echo ""
    echo "🔄 Recarregando nginx..."
    systemctl reload nginx
    echo "✅ Nginx recarregado!"
else
    echo "❌ Erro na configuração!"
    echo "Restaurando backup..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo "✅ Correção aplicada com sucesso!"
ENDSSH

echo ""
echo -e "${GREEN}✅ Correção aplicada no servidor!${NC}"
echo ""
echo -e "${BLUE}🌐 Teste agora: http://agilizeflow.com.br/cadastro${NC}"




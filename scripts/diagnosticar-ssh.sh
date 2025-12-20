#!/bin/bash

# 🔍 Script: Diagnosticar Problemas SSH
# Descrição: Diagnostica e corrige problemas de conexão SSH
# Uso: ./scripts/diagnosticar-ssh.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Diagnóstico SSH - Kanban Buzz         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Configuração
SSH_HOST_ALIAS="kanban-buzz-server"
SSH_HOST_IP="95.217.2.116"
SSH_USER="root"
SSH_KEY="$HOME/.ssh/id_rsa_kanban_buzz"
SSH_CONFIG="$HOME/.ssh/config"

echo -e "${CYAN}📋 Verificando configuração SSH...${NC}"
echo ""

# 1. Verificar se chave existe
echo -e "${YELLOW}1. Verificando chave SSH...${NC}"
if [ -f "$SSH_KEY" ]; then
    echo -e "${GREEN}   ✅ Chave encontrada: $SSH_KEY${NC}"
    ls -lh "$SSH_KEY" | awk '{print "   📄 Permissões:", $1, "| Tamanho:", $5}'
    
    # Verificar permissões
    PERMS=$(stat -c "%a" "$SSH_KEY" 2>/dev/null || stat -f "%OLp" "$SSH_KEY" 2>/dev/null)
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "0600" ]; then
        echo -e "${RED}   ⚠️  Permissões incorretas! Deve ser 600${NC}"
        echo -e "${YELLOW}   🔧 Corrigindo permissões...${NC}"
        chmod 600 "$SSH_KEY"
        echo -e "${GREEN}   ✅ Permissões corrigidas${NC}"
    else
        echo -e "${GREEN}   ✅ Permissões corretas (600)${NC}"
    fi
else
    echo -e "${RED}   ❌ Chave não encontrada: $SSH_KEY${NC}"
    echo -e "${YELLOW}   💡 Execute: ssh-keygen -t rsa -b 4096 -f $SSH_KEY -N \"\"${NC}"
    exit 1
fi

# 2. Verificar chave pública
echo ""
echo -e "${YELLOW}2. Verificando chave pública...${NC}"
if [ -f "${SSH_KEY}.pub" ]; then
    echo -e "${GREEN}   ✅ Chave pública encontrada${NC}"
    echo -e "${CYAN}   📋 Fingerprint:${NC}"
    ssh-keygen -lf "${SSH_KEY}.pub" 2>/dev/null || echo "   (não foi possível ler)"
else
    echo -e "${RED}   ❌ Chave pública não encontrada${NC}"
    exit 1
fi

# 3. Verificar configuração SSH
echo ""
echo -e "${YELLOW}3. Verificando ~/.ssh/config...${NC}"
if [ -f "$SSH_CONFIG" ]; then
    echo -e "${GREEN}   ✅ Arquivo de configuração encontrado${NC}"
    
    # Verificar se host está configurado
    if grep -q "Host kanban-buzz-server" "$SSH_CONFIG"; then
        echo -e "${GREEN}   ✅ Host 'kanban-buzz-server' configurado${NC}"
    else
        echo -e "${RED}   ❌ Host 'kanban-buzz-server' não encontrado na configuração${NC}"
        echo -e "${YELLOW}   💡 Adicione a configuração em ~/.ssh/config${NC}"
    fi
    
    # Verificar permissões
    PERMS=$(stat -c "%a" "$SSH_CONFIG" 2>/dev/null || stat -f "%OLp" "$SSH_CONFIG" 2>/dev/null)
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "644" ] && [ "$PERMS" != "0600" ] && [ "$PERMS" != "0644" ]; then
        echo -e "${YELLOW}   ⚠️  Corrigindo permissões do config...${NC}"
        chmod 600 "$SSH_CONFIG"
    fi
else
    echo -e "${RED}   ❌ Arquivo de configuração não encontrado${NC}"
    echo -e "${YELLOW}   💡 Criando configuração básica...${NC}"
    mkdir -p ~/.ssh
    cat > "$SSH_CONFIG" << EOF
Host kanban-buzz-server
    HostName $SSH_HOST_IP
    User $SSH_USER
    IdentityFile $SSH_KEY
    StrictHostKeyChecking no
    ServerAliveInterval 60
    ServerAliveCountMax 10
    ControlMaster auto
    ControlPath ~/.ssh/control-%h-%p-%r
    ControlPersist 10m
EOF
    chmod 600 "$SSH_CONFIG"
    echo -e "${GREEN}   ✅ Configuração criada${NC}"
fi

# 4. Verificar se chave está autorizada no servidor
echo ""
echo -e "${YELLOW}4. Verificando autorização no servidor...${NC}"
echo -e "${CYAN}   🔍 Tentando conectar...${NC}"

# Tentar conexão com verbose para diagnóstico
if ssh -o ConnectTimeout=5 -o BatchMode=yes "$SSH_HOST_ALIAS" "echo 'OK'" 2>&1 | grep -q "OK"; then
    echo -e "${GREEN}   ✅ Conexão SSH funcionando sem senha!${NC}"
    SSH_WORKING=true
else
    echo -e "${RED}   ❌ Conexão SSH ainda pede senha ou falhou${NC}"
    SSH_WORKING=false
    
    echo ""
    echo -e "${YELLOW}   🔧 Tentando copiar chave pública para o servidor...${NC}"
    echo -e "${CYAN}   💡 Você precisará digitar a senha uma última vez:${NC}"
    echo ""
    
    # Carregar credenciais se existirem
    if [ -f "scripts/.ssh-credentials" ]; then
        source scripts/.ssh-credentials
        if [ -n "$SSH_PASSWORD" ]; then
            echo -e "${CYAN}   📤 Copiando chave pública...${NC}"
            sshpass -p "$SSH_PASSWORD" ssh-copy-id -i "${SSH_KEY}.pub" -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST_IP" 2>&1 | grep -v "password:" || true
            echo -e "${GREEN}   ✅ Chave copiada!${NC}"
            
            # Testar novamente
            echo ""
            echo -e "${CYAN}   🔍 Testando conexão novamente...${NC}"
            if ssh -o ConnectTimeout=5 -o BatchMode=yes "$SSH_HOST_ALIAS" "echo 'OK'" 2>&1 | grep -q "OK"; then
                echo -e "${GREEN}   ✅ Agora funciona sem senha!${NC}"
                SSH_WORKING=true
            else
                echo -e "${RED}   ❌ Ainda não funciona. Verifique os logs acima.${NC}"
            fi
        else
            echo -e "${YELLOW}   💡 Execute manualmente:${NC}"
            echo -e "${CYAN}      ssh-copy-id -i ${SSH_KEY}.pub $SSH_USER@$SSH_HOST_IP${NC}"
        fi
    else
        echo -e "${YELLOW}   💡 Execute manualmente:${NC}"
        echo -e "${CYAN}      ssh-copy-id -i ${SSH_KEY}.pub $SSH_USER@$SSH_HOST_IP${NC}"
    fi
fi

# 5. Resumo e próximos passos
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Resumo do Diagnóstico                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ "$SSH_WORKING" = true ]; then
    echo -e "${GREEN}✅ SSH configurado e funcionando!${NC}"
    echo ""
    echo -e "${CYAN}📋 Comandos úteis:${NC}"
    echo "   ssh kanban-buzz-server"
    echo "   ssh kanban-buzz-server 'cd /opt/app && docker compose ps'"
    echo "   scp arquivo.txt kanban-buzz-server:/opt/app/"
else
    echo -e "${RED}❌ SSH ainda não está funcionando sem senha${NC}"
    echo ""
    echo -e "${YELLOW}📋 Próximos passos:${NC}"
    echo "   1. Verifique os erros acima"
    echo "   2. Execute: ssh -v kanban-buzz-server (para ver logs detalhados)"
    echo "   3. Verifique se a chave está no servidor:"
    echo "      ssh $SSH_USER@$SSH_HOST_IP 'cat ~/.ssh/authorized_keys | grep kanban-buzz-server'"
    echo "   4. Se necessário, copie a chave manualmente:"
    echo "      ssh-copy-id -i ${SSH_KEY}.pub $SSH_USER@$SSH_HOST_IP"
fi

echo ""


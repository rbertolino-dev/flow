#!/bin/bash

# 🔍 Script: Verificar e Comparar Arquivos Locais vs Servidor Hetzner
# Descrição: Verifica se todos os arquivos estão no servidor e faz backup
# Uso: ./scripts/verificar-servidor-hetzner.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
SERVER_IP="95.217.2.116"
SERVER_USER="root"
SERVER_APP_DIR="/opt/app"
LOCAL_DIR="/root/kanban-buzz-95241"
BACKUP_DIR="/root/kanban-buzz-95241/backups/hetzner"
DATE=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}🔍 Verificando servidor Hetzner...${NC}"
echo -e "${BLUE}Servidor: ${SERVER_USER}@${SERVER_IP}${NC}"
echo -e "${BLUE}Diretório no servidor: ${SERVER_APP_DIR}${NC}"
echo ""

# ============================================
# 1. Verificar conexão SSH
# ============================================
echo -e "\n${BLUE}📡 Verificando conexão SSH...${NC}"

if ! ssh -o ConnectTimeout=5 -o BatchMode=yes ${SERVER_USER}@${SERVER_IP} exit 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Não foi possível conectar automaticamente${NC}"
    echo -e "${YELLOW}   Tentando conexão interativa...${NC}"
    echo ""
    echo -e "${BLUE}Por favor, conecte manualmente:${NC}"
    echo "  ssh ${SERVER_USER}@${SERVER_IP}"
    echo ""
    read -p "Conseguiu conectar? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${RED}❌ Não foi possível conectar ao servidor${NC}"
        exit 1
    fi
fi

# ============================================
# 2. Verificar estrutura no servidor
# ============================================
echo -e "\n${BLUE}📂 Verificando estrutura no servidor...${NC}"

# Criar script remoto para verificar estrutura
REMOTE_CHECK_SCRIPT=$(cat <<'EOF'
#!/bin/bash
APP_DIR="/opt/app"
echo "=== Estrutura do Servidor ==="
echo "Diretório: $APP_DIR"
echo ""

if [ -d "$APP_DIR" ]; then
    echo "✅ Diretório existe"
    echo ""
    echo "=== Conteúdo do diretório ==="
    ls -la "$APP_DIR" | head -20
    echo ""
    echo "=== Tamanho total ==="
    du -sh "$APP_DIR" 2>/dev/null || echo "Erro ao calcular tamanho"
    echo ""
    echo "=== Subdiretórios principais ==="
    find "$APP_DIR" -maxdepth 2 -type d | head -20
else
    echo "❌ Diretório não existe"
    echo ""
    echo "=== Verificando outros diretórios possíveis ==="
    ls -la /opt/ 2>/dev/null | head -10
    echo ""
    ls -la /root/ 2>/dev/null | head -10
fi

echo ""
echo "=== Containers Docker ==="
docker ps -a 2>/dev/null | head -10 || echo "Docker não disponível ou sem permissão"

echo ""
echo "=== Volumes Docker ==="
docker volume ls 2>/dev/null | head -10 || echo "Docker não disponível ou sem permissão"
EOF
)

# Executar verificação remota
echo "Executando verificação no servidor..."
ssh ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "$REMOTE_CHECK_SCRIPT"

# ============================================
# 3. Comparar arquivos locais vs servidor
# ============================================
echo -e "\n${BLUE}📊 Comparando arquivos locais vs servidor...${NC}"

# Criar lista de arquivos locais importantes
echo "Criando lista de arquivos locais..."
cd "$LOCAL_DIR"

# Arquivos e diretórios importantes para verificar
IMPORTANT_FILES=(
    "package.json"
    "docker-compose.yml"
    "Dockerfile"
    "vite.config.ts"
    "tsconfig.json"
    "src"
    "supabase"
    "public"
)

# Criar script de comparação remota
COMPARE_SCRIPT=$(cat <<EOF
#!/bin/bash
APP_DIR="${SERVER_APP_DIR}"
LOCAL_FILES="${IMPORTANT_FILES[@]}"

echo "=== Verificando arquivos importantes ==="
for file in ${IMPORTANT_FILES[@]}; do
    if [ -e "\$APP_DIR/\$file" ]; then
        echo "✅ \$file existe"
    else
        echo "❌ \$file NÃO existe"
    fi
done

echo ""
echo "=== Verificando estrutura src/ ==="
if [ -d "\$APP_DIR/src" ]; then
    echo "Subdiretórios em src/:"
    find "\$APP_DIR/src" -maxdepth 1 -type d | sed 's|.*/||' | sort
    echo ""
    echo "Arquivos principais em src/:"
    find "\$APP_DIR/src" -maxdepth 1 -type f | sed 's|.*/||' | sort
else
    echo "❌ Diretório src/ não existe"
fi

echo ""
echo "=== Verificando estrutura supabase/ ==="
if [ -d "\$APP_DIR/supabase" ]; then
    echo "Conteúdo de supabase/:"
    ls -la "\$APP_DIR/supabase" | head -20
    echo ""
    if [ -d "\$APP_DIR/supabase/functions" ]; then
        echo "Edge Functions encontradas:"
        ls -1 "\$APP_DIR/supabase/functions" | wc -l
        echo "funções"
    fi
    if [ -d "\$APP_DIR/supabase/migrations" ]; then
        echo "Migrations encontradas:"
        ls -1 "\$APP_DIR/supabase/migrations" | wc -l
        echo "migrations"
    fi
else
    echo "❌ Diretório supabase/ não existe"
fi
EOF
)

# Executar comparação
ssh ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "$COMPARE_SCRIPT"

# ============================================
# 4. Fazer backup do servidor
# ============================================
echo -e "\n${BLUE}💾 Fazendo backup do servidor...${NC}"

mkdir -p "$BACKUP_DIR"
BACKUP_NAME="backup_hetzner_${DATE}"

# Criar script de backup remoto
BACKUP_SCRIPT=$(cat <<'EOF'
#!/bin/bash
APP_DIR="/opt/app"
BACKUP_TEMP="/tmp/backup_hetzner_$$"

echo "Criando backup temporário..."
mkdir -p "$BACKUP_TEMP"

# Backup de arquivos da aplicação
if [ -d "$APP_DIR" ]; then
    echo "Fazendo backup de $APP_DIR..."
    tar -czf "$BACKUP_TEMP/app_files.tar.gz" -C "$APP_DIR" . 2>/dev/null || {
        echo "Erro ao fazer backup dos arquivos"
        exit 1
    }
    echo "✅ Backup de arquivos criado"
fi

# Backup de configurações
if [ -d "/etc/nginx/sites-available" ]; then
    echo "Fazendo backup do Nginx..."
    tar -czf "$BACKUP_TEMP/nginx_config.tar.gz" -C /etc nginx/sites-available 2>/dev/null || true
fi

# Backup de containers Docker (se houver)
if command -v docker &> /dev/null; then
    echo "Listando containers..."
    docker ps -a > "$BACKUP_TEMP/docker_containers.txt" 2>/dev/null || true
    
    echo "Listando volumes..."
    docker volume ls > "$BACKUP_TEMP/docker_volumes.txt" 2>/dev/null || true
fi

# Criar arquivo de informações
cat > "$BACKUP_TEMP/backup_info.txt" <<INFO
Backup criado em: $(date)
Servidor: $(hostname)
IP: $(hostname -I | awk '{print $1}')
Sistema: $(uname -a)
INFO

echo "✅ Backup temporário criado em $BACKUP_TEMP"
echo "$BACKUP_TEMP"
EOF
)

# Executar backup remoto e copiar
echo "Executando backup no servidor..."
BACKUP_TEMP_DIR=$(ssh ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "$BACKUP_SCRIPT")

if [ -n "$BACKUP_TEMP_DIR" ]; then
    echo "Copiando backup do servidor..."
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
    
    # Copiar arquivos do backup
    scp -r ${SERVER_USER}@${SERVER_IP}:${BACKUP_TEMP_DIR}/* "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Erro ao copiar alguns arquivos${NC}"
    }
    
    # Limpar backup temporário no servidor
    ssh ${SERVER_USER}@${SERVER_IP} "rm -rf $BACKUP_TEMP_DIR" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Backup copiado para: $BACKUP_DIR/$BACKUP_NAME${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível criar backup${NC}"
fi

# ============================================
# 5. Resumo e recomendações
# ============================================
echo -e "\n${GREEN}✅ Verificação concluída!${NC}"
echo ""
echo -e "${BLUE}📋 Resumo:${NC}"
echo "  Backup localizado em: $BACKUP_DIR/$BACKUP_NAME"
echo ""
echo -e "${BLUE}💡 Próximos passos:${NC}"
echo "  1. Revisar a comparação acima"
echo "  2. Verificar se todos os arquivos importantes estão no servidor"
echo "  3. Se faltar arquivos, fazer deploy:"
echo "     ./scripts/hetzner/deploy-app.sh"
echo "  4. Verificar backup em: $BACKUP_DIR/$BACKUP_NAME"




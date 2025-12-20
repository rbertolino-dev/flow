#!/bin/bash

# 🔍 Script: Verificação Completa do Servidor Hetzner
# Descrição: Verifica arquivos no servidor e faz backup completo
# Uso: ./scripts/verificar-hetzner-completo.sh

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
REPORT_DIR="/root/kanban-buzz-95241/backups/relatorios"
DATE=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}🔍 Verificação Completa do Servidor Hetzner${NC}"
echo -e "${BLUE}Servidor: ${SERVER_USER}@${SERVER_IP}${NC}"
echo ""

# ============================================
# 1. Verificar conexão SSH
# ============================================
echo -e "\n${BLUE}📡 Tentando conectar ao servidor...${NC}"

# Tentar diferentes métodos de conexão
SSH_CONNECTED=false

# Método 1: Conexão direta (se chave SSH estiver configurada)
if ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "echo 'OK'" 2>/dev/null; then
    SSH_CONNECTED=true
    echo -e "${GREEN}✅ Conexão SSH estabelecida (chave SSH)${NC}"
# Método 2: Tentar com sshpass (se disponível)
elif command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}⚠️  Tentando com sshpass...${NC}"
    if [ -n "$SSH_PASSWORD" ]; then
        if sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "echo 'OK'" 2>/dev/null; then
            SSH_CONNECTED=true
            echo -e "${GREEN}✅ Conexão SSH estabelecida (sshpass)${NC}"
        fi
    fi
fi

if [ "$SSH_CONNECTED" = false ]; then
    echo -e "${YELLOW}⚠️  Não foi possível conectar automaticamente${NC}"
    echo ""
    echo -e "${BLUE}Opções disponíveis:${NC}"
    echo "  1. Configurar chave SSH (recomendado)"
    echo "  2. Usar autenticação por senha"
    echo "  3. Executar script manualmente no servidor"
    echo ""
    echo -e "${BLUE}Para configurar chave SSH:${NC}"
    echo "  ssh-keygen -t rsa -b 4096"
    echo "  ssh-copy-id ${SERVER_USER}@${SERVER_IP}"
    echo ""
    echo -e "${BLUE}Ou fornecer senha via variável:${NC}"
    echo "  export SSH_PASSWORD='sua_senha'"
    echo "  ./scripts/verificar-hetzner-completo.sh"
    echo ""
    echo -e "${YELLOW}Continuando com verificação local apenas...${NC}"
    SSH_CONNECTED=false
fi

# ============================================
# 2. Verificar arquivos locais primeiro
# ============================================
echo -e "\n${BLUE}📋 Verificando arquivos locais...${NC}"
if [ -f "./scripts/verificar-arquivos-locais.sh" ]; then
    ./scripts/verificar-arquivos-locais.sh
    echo -e "${GREEN}✅ Relatório local gerado${NC}"
else
    echo -e "${YELLOW}⚠️  Script de verificação local não encontrado${NC}"
fi

# ============================================
# 3. Verificar servidor (se conectado)
# ============================================
if [ "$SSH_CONNECTED" = true ]; then
    echo -e "\n${BLUE}📂 Verificando estrutura no servidor...${NC}"
    
    # Script remoto de verificação
    REMOTE_SCRIPT=$(cat <<'REMOTE_EOF'
#!/bin/bash
APP_DIR="/opt/app"
REPORT_DIR="/tmp/relatorios"
DATE=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/relatorio_servidor_${DATE}.txt"

mkdir -p "$REPORT_DIR"

{
    echo "=========================================="
    echo "RELATÓRIO DO SERVIDOR HETZNER"
    echo "=========================================="
    echo "Data: $(date)"
    echo "Servidor: $(hostname)"
    echo "IP: $(hostname -I | awk '{print $1}')"
    echo "Diretório: $APP_DIR"
    echo ""
    
    echo "=========================================="
    echo "1. VERIFICAÇÃO DO DIRETÓRIO"
    echo "=========================================="
    echo ""
    
    if [ -d "$APP_DIR" ]; then
        echo "✅ Diretório $APP_DIR existe"
        echo ""
        echo "Conteúdo:"
        ls -la "$APP_DIR" | head -30
        echo ""
        echo "Tamanho total:"
        du -sh "$APP_DIR" 2>/dev/null || echo "Erro ao calcular"
    else
        echo "❌ Diretório $APP_DIR NÃO existe"
        echo ""
        echo "Buscando em outros locais:"
        find /opt /root /var/www -maxdepth 2 -name "package.json" 2>/dev/null | head -10
    fi
    echo ""
    
    echo "=========================================="
    echo "2. ARQUIVOS DE CONFIGURAÇÃO"
    echo "=========================================="
    echo ""
    
    IMPORTANT_FILES=("package.json" "docker-compose.yml" "Dockerfile" "vite.config.ts" "tsconfig.json")
    for file in "${IMPORTANT_FILES[@]}"; do
        if [ -f "$APP_DIR/$file" ]; then
            echo "✅ $file"
            echo "   Tamanho: $(du -h "$APP_DIR/$file" | cut -f1)"
            echo "   Modificado: $(stat -c %y "$APP_DIR/$file" 2>/dev/null | cut -d' ' -f1)"
        else
            echo "❌ $file (não encontrado)"
        fi
    done
    echo ""
    
    echo "=========================================="
    echo "3. DIRETÓRIOS PRINCIPAIS"
    echo "=========================================="
    echo ""
    
    for dir in src supabase public scripts; do
        if [ -d "$APP_DIR/$dir" ]; then
            COUNT=$(find "$APP_DIR/$dir" -type f 2>/dev/null | wc -l)
            SIZE=$(du -sh "$APP_DIR/$dir" 2>/dev/null | cut -f1)
            echo "✅ $dir/ ($COUNT arquivos, $SIZE)"
        else
            echo "❌ $dir/ (não encontrado)"
        fi
    done
    echo ""
    
    echo "=========================================="
    echo "4. EDGE FUNCTIONS E MIGRATIONS"
    echo "=========================================="
    echo ""
    
    if [ -d "$APP_DIR/supabase/functions" ]; then
        FUNCTIONS=$(ls -1 "$APP_DIR/supabase/functions" 2>/dev/null | wc -l)
        echo "✅ Edge Functions: $FUNCTIONS"
    else
        echo "❌ supabase/functions não encontrado"
    fi
    
    if [ -d "$APP_DIR/supabase/migrations" ]; then
        MIGRATIONS=$(ls -1 "$APP_DIR/supabase/migrations" 2>/dev/null | wc -l)
        echo "✅ Migrations: $MIGRATIONS"
    else
        echo "❌ supabase/migrations não encontrado"
    fi
    echo ""
    
    echo "=========================================="
    echo "5. CONTAINERS DOCKER"
    echo "=========================================="
    echo ""
    
    if command -v docker &> /dev/null; then
        echo "Containers:"
        docker ps 2>/dev/null | head -10 || echo "Sem permissão"
        echo ""
        echo "Volumes:"
        docker volume ls 2>/dev/null | head -10 || echo "Sem permissão"
    else
        echo "❌ Docker não disponível"
    fi
    echo ""
    
    echo "=========================================="
    echo "FIM DO RELATÓRIO"
    echo "=========================================="
    
} > "$REPORT_FILE"

echo "$REPORT_FILE"
REMOTE_EOF
)
    
    # Executar script remoto
    echo "Executando verificação no servidor..."
    REMOTE_REPORT=$(ssh ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "$REMOTE_SCRIPT")
    
    if [ -n "$REMOTE_REPORT" ]; then
        echo -e "${GREEN}✅ Relatório gerado no servidor${NC}"
        echo "Copiando relatório..."
        
        # Copiar relatório
        mkdir -p "$REPORT_DIR"
        scp ${SERVER_USER}@${SERVER_IP}:"$REMOTE_REPORT" "$REPORT_DIR/" 2>/dev/null && {
            echo -e "${GREEN}✅ Relatório copiado para: $REPORT_DIR/$(basename $REMOTE_REPORT)${NC}"
        } || {
            echo -e "${YELLOW}⚠️  Não foi possível copiar relatório automaticamente${NC}"
            echo "Copie manualmente:"
            echo "  scp ${SERVER_USER}@${SERVER_IP}:$REMOTE_REPORT $REPORT_DIR/"
        }
    fi
    
    # ============================================
    # 4. Fazer backup do servidor
    # ============================================
    echo -e "\n${BLUE}💾 Fazendo backup do servidor...${NC}"
    
    BACKUP_SCRIPT=$(cat <<'BACKUP_EOF'
#!/bin/bash
APP_DIR="/opt/app"
BACKUP_TEMP="/tmp/backup_hetzner_$$"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_TEMP"

if [ -d "$APP_DIR" ]; then
    echo "Fazendo backup de $APP_DIR..."
    tar -czf "$BACKUP_TEMP/app_files.tar.gz" -C "$APP_DIR" . 2>/dev/null || {
        echo "Erro ao fazer backup"
        exit 1
    }
    echo "✅ Backup criado"
    
    # Informações
    cat > "$BACKUP_TEMP/backup_info.txt" <<INFO
Backup criado em: $(date)
Servidor: $(hostname)
IP: $(hostname -I | awk '{print $1}')
Diretório: $APP_DIR
INFO
    
    echo "$BACKUP_TEMP"
else
    echo "❌ Diretório não encontrado"
    exit 1
fi
BACKUP_EOF
)
    
    BACKUP_TEMP_DIR=$(ssh ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "$BACKUP_SCRIPT")
    
    if [ -n "$BACKUP_TEMP_DIR" ] && [ "$BACKUP_TEMP_DIR" != "❌" ]; then
        echo "Copiando backup..."
        mkdir -p "$BACKUP_DIR"
        
        scp -r ${SERVER_USER}@${SERVER_IP}:"$BACKUP_TEMP_DIR"/* "$BACKUP_DIR/backup_${DATE}/" 2>/dev/null && {
            echo -e "${GREEN}✅ Backup copiado para: $BACKUP_DIR/backup_${DATE}/${NC}"
        } || {
            echo -e "${YELLOW}⚠️  Não foi possível copiar backup automaticamente${NC}"
            echo "Copie manualmente:"
            echo "  scp -r ${SERVER_USER}@${SERVER_IP}:$BACKUP_TEMP_DIR/* $BACKUP_DIR/backup_${DATE}/"
        }
        
        # Limpar backup temporário no servidor
        ssh ${SERVER_USER}@${SERVER_IP} "rm -rf $BACKUP_TEMP_DIR" 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠️  Não foi possível criar backup${NC}"
    fi
    
else
    echo -e "\n${YELLOW}⚠️  Verificação do servidor pulada (sem conexão SSH)${NC}"
    echo ""
    echo -e "${BLUE}Para fazer verificação completa:${NC}"
    echo "  1. Configure chave SSH:"
    echo "     ssh-keygen -t rsa -b 4096"
    echo "     ssh-copy-id ${SERVER_USER}@${SERVER_IP}"
    echo ""
    echo "  2. Ou execute manualmente no servidor:"
    echo "     scp scripts/verificar-servidor-remoto.sh ${SERVER_USER}@${SERVER_IP}:/tmp/"
    echo "     ssh ${SERVER_USER}@${SERVER_IP}"
    echo "     bash /tmp/verificar-servidor-remoto.sh"
fi

# ============================================
# 5. Resumo
# ============================================
echo -e "\n${GREEN}✅ Verificação concluída!${NC}"
echo ""
echo -e "${BLUE}📊 Relatórios gerados:${NC}"
echo "  Local: $REPORT_DIR/relatorio_arquivos_*.txt"
if [ "$SSH_CONNECTED" = true ]; then
    echo "  Servidor: $REPORT_DIR/relatorio_servidor_*.txt"
    echo "  Backup: $BACKUP_DIR/backup_${DATE}/"
fi
echo ""
echo -e "${BLUE}💡 Próximos passos:${NC}"
echo "  1. Revisar relatórios gerados"
echo "  2. Comparar arquivos locais vs servidor"
echo "  3. Se faltar arquivos, fazer deploy: ./scripts/hetzner/deploy-app.sh"




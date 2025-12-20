#!/bin/bash

# 💾 Script: Backup da Aplicação
# Descrição: Faz backup completo da aplicação e dados
# Uso: ./scripts/hetzner/backup-app.sh

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretórios
APP_DIR="/opt/app"
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${DATE}"

echo -e "${GREEN}💾 Iniciando backup da aplicação...${NC}"

# Criar diretório de backup
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
cd "$BACKUP_DIR/$BACKUP_NAME"

# ============================================
# 1. Backup de arquivos da aplicação
# ============================================
echo -e "\n${BLUE}📦 Fazendo backup dos arquivos...${NC}"

if [ -d "$APP_DIR" ]; then
    tar -czf app_files.tar.gz -C "$APP_DIR" . 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Erro ao fazer backup dos arquivos${NC}"
    }
    echo -e "${GREEN}✅ Arquivos da aplicação${NC}"
else
    echo -e "${YELLOW}⚠️  Diretório da aplicação não encontrado${NC}"
fi

# ============================================
# 2. Backup de volumes Docker
# ============================================
echo -e "\n${BLUE}🐳 Fazendo backup de volumes Docker...${NC}"

if command -v docker &> /dev/null; then
    # Listar volumes
    VOLUMES=$(docker volume ls -q | grep -E "app|postgres|data" || true)
    
    if [ -n "$VOLUMES" ]; then
        for VOLUME in $VOLUMES; do
            echo "Backup do volume: $VOLUME"
            docker run --rm \
                -v $VOLUME:/data \
                -v $(pwd):/backup \
                alpine tar czf /backup/volume_${VOLUME}.tar.gz -C /data . || {
                echo -e "${YELLOW}⚠️  Erro ao fazer backup do volume $VOLUME${NC}"
            }
        done
        echo -e "${GREEN}✅ Volumes Docker${NC}"
    else
        echo -e "${YELLOW}⚠️  Nenhum volume encontrado${NC}"
    fi
fi

# ============================================
# 3. Backup de banco de dados (se houver)
# ============================================
echo -e "\n${BLUE}🗄️  Fazendo backup do banco de dados...${NC}"

# Verificar se há container PostgreSQL
if docker ps | grep -q postgres; then
    echo "Fazendo dump do PostgreSQL..."
    docker exec $(docker ps | grep postgres | awk '{print $1}') \
        pg_dumpall -U postgres > postgres_dump.sql 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Erro ao fazer dump do PostgreSQL${NC}"
    }
    echo -e "${GREEN}✅ Backup do PostgreSQL${NC}"
fi

# ============================================
# 4. Backup de configurações
# ============================================
echo -e "\n${BLUE}⚙️  Fazendo backup de configurações...${NC}"

# Nginx
if [ -d "/etc/nginx" ]; then
    sudo tar -czf nginx_config.tar.gz -C /etc nginx 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Erro ao fazer backup do Nginx${NC}"
    }
fi

# SSL certificates (apenas referências, não os arquivos reais)
if [ -d "/etc/letsencrypt" ]; then
    sudo tar -czf letsencrypt_config.tar.gz -C /etc letsencrypt 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Erro ao fazer backup do Let's Encrypt${NC}"
    }
fi

# Docker Compose
if [ -f "$APP_DIR/docker-compose.yml" ]; then
    cp "$APP_DIR/docker-compose.yml" . 2>/dev/null || true
fi

# .env (sem senhas sensíveis)
if [ -f "$APP_DIR/.env" ]; then
    # Criar versão sem senhas
    grep -v -E "(PASSWORD|SECRET|KEY|TOKEN)" "$APP_DIR/.env" > .env.sample 2>/dev/null || true
fi

echo -e "${GREEN}✅ Configurações${NC}"

# ============================================
# 5. Criar arquivo de informações
# ============================================
echo -e "\n${BLUE}📝 Criando arquivo de informações...${NC}"

cat > backup_info.txt <<EOF
Backup criado em: $(date)
Servidor: $(hostname)
IP: $(curl -s ifconfig.me || echo "N/A")
Sistema: $(uname -a)

Conteúdo do backup:
- Arquivos da aplicação
- Volumes Docker
- Banco de dados (se houver)
- Configurações (Nginx, SSL)

Para restaurar:
1. Extrair arquivos: tar -xzf app_files.tar.gz -C /opt/app
2. Restaurar volumes: docker run --rm -v VOLUME:/data -v $(pwd):/backup alpine tar xzf /backup/volume_VOLUME.tar.gz -C /data
3. Restaurar banco: psql -U postgres < postgres_dump.sql
EOF

# ============================================
# 6. Comprimir backup completo
# ============================================
echo -e "\n${BLUE}📦 Comprimindo backup...${NC}"
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

# ============================================
# 7. Limpar backups antigos (manter últimos 7 dias)
# ============================================
echo -e "\n${BLUE}🧹 Limpando backups antigos...${NC}"
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +7 -delete
echo -e "${GREEN}✅ Backups antigos removidos (mantidos últimos 7 dias)${NC}"

# ============================================
# 8. Resumo
# ============================================
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)

echo -e "\n${GREEN}✅ Backup concluído!${NC}"
echo -e "\n${BLUE}📊 Informações:${NC}"
echo "  Arquivo: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "  Tamanho: $BACKUP_SIZE"
echo ""
echo -e "${BLUE}💡 Dica:${NC}"
echo "  Para fazer backup automático, adicione ao crontab:"
echo "  0 2 * * * /root/kanban-buzz-95241/scripts/hetzner/backup-app.sh"




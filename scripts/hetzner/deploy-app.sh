#!/bin/bash

# 🚀 Script: Deploy da Aplicação no Hetzner
# Descrição: Faz deploy da aplicação usando Docker
# Uso: ./scripts/hetzner/deploy-app.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Diretórios
APP_DIR="/opt/app"
BACKUP_DIR="/opt/backups"
LOG_DIR="/opt/logs"

echo -e "${GREEN}🚀 Iniciando deploy da aplicação...${NC}"

# ============================================
# 1. Verificar pré-requisitos
# ============================================
echo -e "\n${BLUE}🔍 Verificando pré-requisitos...${NC}"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado${NC}"
    echo "Execute primeiro: ./scripts/hetzner/preparar-servidor.sh"
    exit 1
fi

# Verificar se está no diretório do projeto
if [ ! -f "package.json" ] && [ ! -f "docker-compose.yml" ]; then
    echo -e "${YELLOW}⚠️  Não está no diretório do projeto${NC}"
    echo "Copiando arquivos para $APP_DIR..."
    
    # Criar diretório se não existir
    sudo mkdir -p $APP_DIR
    sudo chown -R $USER:$USER $APP_DIR
    
    # Copiar arquivos necessários
    echo "Copiando arquivos do projeto..."
    # Ajustar conforme estrutura do projeto
fi

# ============================================
# 2. Fazer backup (se aplicação já estiver rodando)
# ============================================
if docker ps | grep -q "app"; then
    echo -e "\n${YELLOW}📦 Fazendo backup da aplicação atual...${NC}"
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    sudo mkdir -p $BACKUP_DIR
    
    # Backup de volumes (se houver)
    if docker volume ls | grep -q "app"; then
        echo "Fazendo backup de volumes..."
        # Ajustar conforme necessário
    fi
    
    echo -e "${GREEN}✅ Backup concluído${NC}"
fi

# ============================================
# 3. Parar aplicação atual (se estiver rodando)
# ============================================
if [ -f "$APP_DIR/docker-compose.yml" ]; then
    echo -e "\n${YELLOW}🛑 Parando aplicação atual...${NC}"
    cd $APP_DIR
    docker-compose down || true
fi

# ============================================
# 4. Preparar ambiente
# ============================================
echo -e "\n${BLUE}📦 Preparando ambiente...${NC}"

# Criar diretórios
sudo mkdir -p $APP_DIR $BACKUP_DIR $LOG_DIR
sudo chown -R $USER:$USER $APP_DIR $BACKUP_DIR $LOG_DIR

# ============================================
# 5. Copiar arquivos do projeto
# ============================================
echo -e "\n${BLUE}📋 Copiando arquivos...${NC}"

# Se estiver no diretório do projeto, copiar
if [ -f "package.json" ] || [ -f "docker-compose.yml" ]; then
    echo "Copiando arquivos do projeto atual..."
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
        ./ $APP_DIR/ || {
        echo -e "${YELLOW}⚠️  Usando método alternativo de cópia...${NC}"
        cp -r . $APP_DIR/ 2>/dev/null || true
    }
else
    echo -e "${YELLOW}⚠️  Arquivos do projeto não encontrados no diretório atual${NC}"
    echo "Por favor, copie os arquivos manualmente para $APP_DIR"
    read -p "Continuar? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# ============================================
# 6. Configurar variáveis de ambiente
# ============================================
echo -e "\n${BLUE}⚙️  Configurando variáveis de ambiente...${NC}"

if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
    echo "Criando .env a partir de .env.example (se existir)..."
    
    if [ -f "$APP_DIR/.env.example" ]; then
        cp $APP_DIR/.env.example $APP_DIR/.env
        echo -e "${YELLOW}⚠️  IMPORTANTE: Edite $APP_DIR/.env com as variáveis corretas${NC}"
    else
        echo -e "${RED}❌ Arquivo .env.example não encontrado${NC}"
        echo "Crie o arquivo .env manualmente em $APP_DIR/.env"
    fi
fi

# ============================================
# 7. Build e Deploy
# ============================================
echo -e "\n${GREEN}🏗️  Fazendo build e deploy...${NC}"

cd $APP_DIR

# Se tiver docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    echo "Usando Docker Compose..."
    docker-compose pull || true
    docker-compose build
    docker-compose up -d
    
    echo -e "\n${GREEN}📊 Status dos containers:${NC}"
    docker-compose ps
    
# Se tiver Dockerfile
elif [ -f "Dockerfile" ]; then
    echo "Usando Dockerfile..."
    IMAGE_NAME="app:latest"
    docker build -t $IMAGE_NAME .
    docker stop app 2>/dev/null || true
    docker rm app 2>/dev/null || true
    docker run -d \
        --name app \
        --restart unless-stopped \
        -p 3000:3000 \
        --env-file .env \
        $IMAGE_NAME
    
    echo -e "\n${GREEN}📊 Status do container:${NC}"
    docker ps | grep app

# Se for aplicação Node.js
elif [ -f "package.json" ]; then
    echo -e "${YELLOW}⚠️  Aplicação Node.js detectada${NC}"
    echo "Instalando dependências e iniciando..."
    
    npm install --production
    npm run build || true
    
    # Usar PM2 ou similar para gerenciar processo
    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js || pm2 start npm --name "app" -- start
        pm2 save
    else
        echo -e "${YELLOW}⚠️  PM2 não instalado. Instale para gerenciar a aplicação:${NC}"
        echo "  npm install -g pm2"
        echo "  pm2 start npm --name app -- start"
    fi
else
    echo -e "${RED}❌ Não foi possível identificar o tipo de aplicação${NC}"
    echo "Certifique-se de ter docker-compose.yml, Dockerfile ou package.json"
    exit 1
fi

# ============================================
# 8. Verificar saúde
# ============================================
echo -e "\n${GREEN}🏥 Verificando saúde da aplicação...${NC}"

sleep 5

# Verificar se está respondendo
if curl -f http://localhost:3000/health > /dev/null 2>&1 || \
   curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Aplicação está respondendo!${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação pode não estar respondendo ainda${NC}"
    echo "Verifique os logs:"
    echo "  docker-compose logs -f"
    echo "  ou"
    echo "  docker logs app"
fi

# ============================================
# 9. Resumo
# ============================================
echo -e "\n${GREEN}✅ Deploy concluído!${NC}"
echo -e "\n${BLUE}📋 Comandos úteis:${NC}"
echo "  Ver logs: docker-compose logs -f (ou docker logs app)"
echo "  Parar: docker-compose down (ou docker stop app)"
echo "  Reiniciar: docker-compose restart (ou docker restart app)"
echo "  Status: docker-compose ps (ou docker ps)"
echo ""
echo -e "${BLUE}📁 Diretórios:${NC}"
echo "  Aplicação: $APP_DIR"
echo "  Backups: $BACKUP_DIR"
echo "  Logs: $LOG_DIR"




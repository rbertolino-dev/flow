#!/bin/bash

# 🔄 Script: Rebuild Rápido da Aplicação no Hetzner
# Descrição: Faz rebuild do container Docker com as últimas mudanças
# Uso: ./scripts/hetzner/rebuild-app.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🔄 Iniciando rebuild da aplicação...${NC}"

# Verificar se está no diretório do projeto
if [ ! -f "docker-compose.yml" ] && [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Não está no diretório do projeto${NC}"
    echo "Execute este script do diretório raiz do projeto"
    exit 1
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado${NC}"
    exit 1
fi

# Parar container atual
echo -e "\n${YELLOW}🛑 Parando container atual...${NC}"
if [ -f "docker-compose.yml" ]; then
    docker-compose down || true
else
    docker stop kanban-buzz-app 2>/dev/null || true
    docker rm kanban-buzz-app 2>/dev/null || true
fi

# Limpar imagens antigas (opcional, descomente se quiser)
# echo -e "\n${YELLOW}🧹 Limpando imagens antigas...${NC}"
# docker image prune -f || true

# Build novo
echo -e "\n${GREEN}🏗️  Fazendo build da nova imagem...${NC}"
if [ -f "docker-compose.yml" ]; then
    docker-compose build --no-cache
    echo -e "\n${GREEN}🚀 Iniciando container...${NC}"
    docker-compose up -d
    echo -e "\n${GREEN}📊 Status dos containers:${NC}"
    docker-compose ps
else
    docker build -t kanban-buzz-app:latest .
    docker run -d \
        --name kanban-buzz-app \
        --restart unless-stopped \
        -p 3000:80 \
        kanban-buzz-app:latest
    echo -e "\n${GREEN}📊 Status do container:${NC}"
    docker ps | grep kanban-buzz-app
fi

# Aguardar alguns segundos
echo -e "\n${BLUE}⏳ Aguardando aplicação iniciar...${NC}"
sleep 5

# Verificar logs
echo -e "\n${BLUE}📋 Últimas linhas dos logs:${NC}"
if [ -f "docker-compose.yml" ]; then
    docker-compose logs --tail=20
else
    docker logs --tail=20 kanban-buzz-app
fi

echo -e "\n${GREEN}✅ Rebuild concluído!${NC}"
echo -e "\n${BLUE}📋 Comandos úteis:${NC}"
echo "  Ver logs: docker-compose logs -f (ou docker logs -f kanban-buzz-app)"
echo "  Parar: docker-compose down (ou docker stop kanban-buzz-app)"
echo "  Reiniciar: docker-compose restart (ou docker restart kanban-buzz-app)"



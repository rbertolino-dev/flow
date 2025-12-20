#!/bin/bash

# 🔄 Script: Rebuild Completo do Docker
# Execute este script no servidor Hetzner após fazer git pull

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🔄 Rebuild Completo do Docker${NC}"
echo -e "${BLUE}================================${NC}\n"

# Verificar se está no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml não encontrado${NC}"
    echo "Execute este script do diretório raiz do projeto"
    exit 1
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado${NC}"
    exit 1
fi

# Verificar qual comando usar (v5 ou v1)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    DOCKER_COMPOSE_CMD="docker-compose"
fi

# Parar containers
echo -e "\n${YELLOW}🛑 Parando containers atuais...${NC}"
$DOCKER_COMPOSE_CMD down || true

# Limpar imagens antigas (opcional - descomente se quiser limpar)
# echo -e "\n${YELLOW}🧹 Limpando imagens antigas...${NC}"
# docker image prune -f || true

# Build sem cache (importante para pegar todas as mudanças)
echo -e "\n${GREEN}🏗️  Fazendo build da nova imagem (sem cache)...${NC}"
$DOCKER_COMPOSE_CMD build --no-cache

# Subir containers
echo -e "\n${GREEN}🚀 Iniciando containers...${NC}"
$DOCKER_COMPOSE_CMD up -d

# Aguardar inicialização
echo -e "\n${BLUE}⏳ Aguardando aplicação iniciar (10 segundos)...${NC}"
sleep 10

# Verificar status
echo -e "\n${GREEN}📊 Status dos containers:${NC}"
$DOCKER_COMPOSE_CMD ps

# Mostrar logs recentes
echo -e "\n${BLUE}📋 Últimas 30 linhas dos logs:${NC}"
$DOCKER_COMPOSE_CMD logs --tail=30 app 2>/dev/null || $DOCKER_COMPOSE_CMD logs --tail=30

# Verificar se está respondendo
echo -e "\n${BLUE}🔍 Verificando se aplicação está respondendo...${NC}"
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Aplicação está respondendo na porta 3000!${NC}"
else
    echo -e "${YELLOW}⚠️  Aplicação pode ainda estar iniciando...${NC}"
    echo "Verifique os logs com: docker-compose logs -f"
fi

echo -e "\n${GREEN}✅ Rebuild concluído!${NC}"
echo -e "\n${BLUE}📋 Comandos úteis:${NC}"
echo "  Ver logs em tempo real: $DOCKER_COMPOSE_CMD logs -f"
echo "  Parar: $DOCKER_COMPOSE_CMD down"
echo "  Reiniciar: $DOCKER_COMPOSE_CMD restart"
echo "  Status: $DOCKER_COMPOSE_CMD ps"


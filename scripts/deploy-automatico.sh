#!/bin/bash

# 🚀 Script: Deploy Automático Completo
# Descrição: Faz deploy completo da aplicação no servidor Hetzner
# Uso: Execute no servidor Hetzner após fazer git pull
# Autor: Sistema Automatizado

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Deploy Automático - Iniciando...${NC}"
echo -e "${BLUE}=====================================${NC}\n"

# Diretório do projeto (ajustar se necessário)
PROJECT_DIR="/root/kanban-buzz-95241"

# Verificar se está no diretório correto
if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml não encontrado em $PROJECT_DIR${NC}"
    echo "Ajuste PROJECT_DIR no script ou execute do diretório do projeto"
    exit 1
fi

cd "$PROJECT_DIR"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado${NC}"
    exit 1
fi

# Verificar Docker Compose (versão nova ou antiga)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
    echo -e "${GREEN}✅ Usando Docker Compose v2 (docker compose)${NC}"
elif docker-compose --version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
    echo -e "${GREEN}✅ Usando Docker Compose v1 (docker-compose)${NC}"
else
    echo -e "${RED}❌ Docker Compose não encontrado${NC}"
    exit 1
fi

# 1. Atualizar código (se for repositório git)
if [ -d ".git" ]; then
    echo -e "\n${BLUE}📥 Atualizando código do Git...${NC}"
    git pull || echo -e "${YELLOW}⚠️  Git pull falhou ou não há mudanças${NC}"
else
    echo -e "\n${YELLOW}⚠️  Não é um repositório Git, pulando git pull${NC}"
fi

# 2. Parar containers atuais
echo -e "\n${YELLOW}🛑 Parando containers atuais...${NC}"
$DOCKER_COMPOSE_CMD down || true

# Remover container antigo se ainda existir (compatibilidade)
if docker ps -a | grep -q "kanban-buzz-app"; then
    echo -e "${YELLOW}🧹 Removendo container antigo...${NC}"
    docker stop kanban-buzz-app 2>/dev/null || true
    docker rm kanban-buzz-app 2>/dev/null || true
fi

# 3. Build sem cache (importante para pegar todas as mudanças)
echo -e "\n${GREEN}🏗️  Fazendo build da nova imagem (sem cache)...${NC}"
echo -e "${BLUE}   Isso pode levar alguns minutos...${NC}"
echo -e "${YELLOW}   ⚠️  IMPORTANTE: Build sem cache é obrigatório para evitar erros de bundle desatualizado${NC}"
echo -e "${YELLOW}   📋 Veja REGISTRO-ERROS-DEPLOY.md para mais detalhes sobre erros conhecidos${NC}"
$DOCKER_COMPOSE_CMD build --no-cache

# Verificar se build foi bem-sucedido
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build falhou! Verifique os erros acima.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build concluído com sucesso!${NC}"

# 4. Subir containers
echo -e "\n${GREEN}🚀 Iniciando containers...${NC}"
$DOCKER_COMPOSE_CMD up -d

# 5. Aguardar inicialização
echo -e "\n${BLUE}⏳ Aguardando aplicação iniciar (10 segundos)...${NC}"
sleep 10

# 6. Verificar status
echo -e "\n${GREEN}📊 Status dos containers:${NC}"
$DOCKER_COMPOSE_CMD ps

# 7. Mostrar logs recentes
echo -e "\n${BLUE}📋 Últimas 30 linhas dos logs:${NC}"
$DOCKER_COMPOSE_CMD logs --tail=30 app 2>/dev/null || $DOCKER_COMPOSE_CMD logs --tail=30

# 8. Verificar se está respondendo
echo -e "\n${BLUE}🔍 Verificando se aplicação está respondendo...${NC}"
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Aplicação está respondendo na porta 3000!${NC}"
    
    # 8.1. Validar hash do bundle (prevenção de erro #001)
    echo -e "\n${BLUE}🔍 Validando hash do bundle JavaScript...${NC}"
    BUNDLE_HASH=$(curl -s http://localhost:3000 2>/dev/null | grep -o 'index-[^"]*\.js' | head -1)
    if [ -z "$BUNDLE_HASH" ]; then
        echo -e "${RED}❌ ERRO: Bundle JavaScript não encontrado!${NC}"
        echo -e "${YELLOW}   Isso pode indicar que o build falhou silenciosamente.${NC}"
        echo -e "${YELLOW}   Verifique os logs: $DOCKER_COMPOSE_CMD logs app${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Bundle detectado: $BUNDLE_HASH${NC}"
        echo -e "${BLUE}   💡 Se este hash não mudou após mudanças no código, o build pode estar desatualizado.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Aplicação pode ainda estar iniciando...${NC}"
    echo "Verifique os logs com: $DOCKER_COMPOSE_CMD logs -f"
fi

# 10. Resumo
echo -e "\n${GREEN}✅ Deploy concluído!${NC}"
echo -e "\n${BLUE}📋 Comandos úteis:${NC}"
echo "  Ver logs em tempo real: $DOCKER_COMPOSE_CMD logs -f"
echo "  Parar: $DOCKER_COMPOSE_CMD down"
echo "  Reiniciar: $DOCKER_COMPOSE_CMD restart"
echo "  Status: $DOCKER_COMPOSE_CMD ps"
echo "  Rebuild rápido: $DOCKER_COMPOSE_CMD up -d --build"

echo -e "\n${GREEN}🎉 Pronto! Aplicação está no ar.${NC}"
echo -e "${YELLOW}💡 Dica: Limpe o cache do navegador (Ctrl+Shift+Delete) para ver as mudanças.${NC}"
echo -e "${BLUE}📋 Documentação:${NC}"
echo -e "   - Erros conhecidos: REGISTRO-ERROS-DEPLOY.md"
echo -e "   - Guia de deploy: DEPLOY-AUTOMATICO.md"
echo -e "\n${BLUE}🔍 Validação Pós-Deploy:${NC}"
echo -e "   Se encontrar erros de 'ReferenceError' ou tela em branco:"
echo -e "   1. Verifique o hash do bundle: curl -s http://localhost:3000 | grep -o 'index-[^"]*\.js'"
echo -e "   2. Se hash não mudou após mudanças no código, execute rebuild:"
echo -e "      $DOCKER_COMPOSE_CMD down && $DOCKER_COMPOSE_CMD build --no-cache && $DOCKER_COMPOSE_CMD up -d"


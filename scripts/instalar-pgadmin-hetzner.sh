#!/bin/bash

# Script para instalar pgAdmin no servidor Hetzner
# Acesso via web: http://95.217.2.116:5050

set -e

echo "🚀 Instalando pgAdmin no servidor Hetzner..."
echo ""

# Variáveis
PGADMIN_EMAIL="admin@kanbanbuzz.com"
PGADMIN_PASSWORD="Admin@KanbanBuzz2025!"
PGADMIN_PORT="5050"
CONTAINER_NAME="pgadmin-kanban-buzz"

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Instalando..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Parar container existente se houver
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "🛑 Parando container existente..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# Criar diretório para dados do pgAdmin
mkdir -p /var/lib/pgadmin
chmod 755 /var/lib/pgadmin

# Executar pgAdmin
echo "📦 Iniciando pgAdmin..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "$PGADMIN_PORT:80" \
  -e PGADMIN_DEFAULT_EMAIL="$PGADMIN_EMAIL" \
  -e PGADMIN_DEFAULT_PASSWORD="$PGADMIN_PASSWORD" \
  -e PGADMIN_CONFIG_SERVER_MODE='False' \
  -v /var/lib/pgadmin:/var/lib/pgadmin \
  dpage/pgadmin4:latest

# Aguardar pgAdmin iniciar
echo "⏳ Aguardando pgAdmin iniciar (30 segundos)..."
sleep 30

# Verificar se está rodando
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "✅ pgAdmin instalado e rodando!"
    echo ""
    echo "🌐 Acesse em: http://95.217.2.116:$PGADMIN_PORT"
    echo ""
    echo "📧 Credenciais de Login:"
    echo "   Email: $PGADMIN_EMAIL"
    echo "   Senha: $PGADMIN_PASSWORD"
    echo ""
    echo "📊 Para adicionar servidor PostgreSQL:"
    echo "   1. Após login, clique em 'Add New Server'"
    echo "   2. General > Name: Hetzner PostgreSQL"
    echo "   3. Connection > Host: 95.217.2.116"
    echo "   4. Connection > Port: 5432"
    echo "   5. Connection > Database: budget_services"
    echo "   6. Connection > Username: budget_user"
    echo "   7. Connection > Password: XdgoSA4ABHSRWdTXA5cKDfJJs"
    echo "   8. Clique em 'Save'"
    echo ""
    echo "🔒 Abrindo porta no firewall..."
    ufw allow "$PGADMIN_PORT/tcp" 2>/dev/null || echo "⚠️  UFW não configurado, verificar firewall manualmente"
    echo ""
    echo "✅ Pronto! Acesse http://95.217.2.116:$PGADMIN_PORT"
else
    echo "❌ Erro ao iniciar pgAdmin. Verifique os logs:"
    echo "   docker logs $CONTAINER_NAME"
    exit 1
fi


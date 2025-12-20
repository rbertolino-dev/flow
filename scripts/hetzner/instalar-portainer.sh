#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then 
    SUDO="sudo"
else
    SUDO=""
fi

echo "╔════════════════════════════════════════╗"
echo "║  Instalando Portainer                ║"
echo "╚════════════════════════════════════════╝"
echo ""

if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado"
    exit 1
fi

echo "✅ Docker encontrado"

echo ""
echo "📦 Criando volume..."
docker volume create portainer_data 2>/dev/null || echo "Volume já existe"

echo ""
echo "🛑 Parando Portainer existente..."
docker stop portainer 2>/dev/null || true
docker rm portainer 2>/dev/null || true

echo ""
echo "🐳 Instalando Portainer..."
docker run -d \
  --name portainer \
  --restart=always \
  -p 9000:9000 \
  -p 9443:9443 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest

sleep 5

if docker ps | grep -q portainer; then
    echo "✅ Portainer instalado!"
else
    echo "❌ Erro ao iniciar"
    docker logs portainer --tail 10
    exit 1
fi

echo ""
echo "🔥 Configurando firewall..."
$SUDO ufw allow 9000/tcp comment 'Portainer HTTP'
$SUDO ufw allow 9443/tcp comment 'Portainer HTTPS'

SERVER_IP=$(curl -4 -s ifconfig.me)

echo ""
echo "✅ Portainer instalado!"
echo ""
echo "🌐 Acesse:"
echo "   http://$SERVER_IP:9000"
echo "   https://$SERVER_IP:9443"
echo ""
echo "📋 Primeiro acesso:"
echo "   1. Crie uma senha de administrador"
echo "   2. Selecione 'Docker' como ambiente"
echo ""




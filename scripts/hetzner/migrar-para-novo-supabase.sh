#!/bin/bash
set -e

NOVO_PROJECT_ID="ogeljmbhqxpfjbpnbwog"
NOVO_URL="https://${NOVO_PROJECT_ID}.supabase.co"
APP_DIR="/opt/app"

echo "╔════════════════════════════════════════╗"
echo "║  Migração para Novo Supabase         ║"
echo "╚════════════════════════════════════════╝"
echo ""

if [ -z "$1" ]; then
    echo "📋 Novo Project ID: $NOVO_PROJECT_ID"
    echo "📋 URL: $NOVO_URL"
    echo ""
    echo "⚠️  Preciso da nova Anon Key"
    echo "   Encontre em: Supabase Dashboard > Settings > API"
    echo ""
    read -p "Digite a nova Anon Key: " NOVA_ANON_KEY
else
    NOVA_ANON_KEY=$1
fi

[ -z "$NOVA_ANON_KEY" ] && { echo "❌ Anon Key não fornecida"; exit 1; }

echo ""
echo "📋 Configuração:"
echo "   Project ID: $NOVO_PROJECT_ID"
echo "   URL: $NOVO_URL"
echo ""
read -p "Continuar? (s/N): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Ss]$ ]] && exit 1

echo ""
echo "💾 Backup do .env..."
cp "$APP_DIR/.env" "$APP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"

echo "📝 Atualizando .env..."
cd "$APP_DIR"
sed -i "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=\"$NOVO_URL\"|" .env
sed -i "s|VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=\"$NOVA_ANON_KEY\"|" .env
sed -i "s|VITE_SUPABASE_PROJECT_ID=.*|VITE_SUPABASE_PROJECT_ID=\"$NOVO_PROJECT_ID\"|" .env

echo "🏗️  Rebuild..."
docker compose down
docker compose build --no-cache
docker compose up -d

echo ""
echo "✅ Migração concluída!"
echo "🌐 Teste: http://95.217.2.116:3000"
echo ""




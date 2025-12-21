#!/bin/bash

# Script para configurar variáveis de ambiente do PostgreSQL na Edge Function products
# Uso: bash scripts/configurar-products-secrets.sh

set -e

echo "🔧 Configurando variáveis de ambiente do PostgreSQL na Edge Function products..."
echo ""

# Token do Supabase CLI
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

# Project ID
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

# Carregar credenciais SSH
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.ssh-credentials"

# Ler credenciais do PostgreSQL do servidor
echo "📋 Lendo credenciais do PostgreSQL do servidor..."
SSH_CMD="cat /root/postgresql-budget-credentials.txt 2>/dev/null || echo 'POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=budget_services
POSTGRES_USER=budget_user
POSTGRES_PASSWORD='"

CREDS=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$SSH_CMD")

if [ -z "$CREDS" ]; then
    echo "❌ Não foi possível ler credenciais do PostgreSQL"
    exit 1
fi

POSTGRES_HOST_ORIG=$(echo "$CREDS" | grep "POSTGRES_HOST=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_PORT=$(echo "$CREDS" | grep "POSTGRES_PORT=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_DB=$(echo "$CREDS" | grep "POSTGRES_DB=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_USER=$(echo "$CREDS" | grep "POSTGRES_USER=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_PASSWORD=$(echo "$CREDS" | grep "POSTGRES_PASSWORD=" | cut -d'=' -f2 | tr -d ' ')

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Senha do PostgreSQL não encontrada"
    exit 1
fi

# Se POSTGRES_HOST for localhost, usar IP do servidor (Edge Functions não conseguem acessar localhost)
if [ "$POSTGRES_HOST_ORIG" = "localhost" ] || [ "$POSTGRES_HOST_ORIG" = "127.0.0.1" ]; then
    POSTGRES_HOST="$SSH_HOST"  # Usar IP do servidor (95.217.2.116)
    echo "⚠️  POSTGRES_HOST era 'localhost', alterando para IP do servidor: $POSTGRES_HOST"
else
    POSTGRES_HOST="$POSTGRES_HOST_ORIG"
fi

echo "📋 Valores encontrados:"
echo "   POSTGRES_HOST: $POSTGRES_HOST (original: $POSTGRES_HOST_ORIG)"
echo "   POSTGRES_PORT: $POSTGRES_PORT"
echo "   POSTGRES_DB: $POSTGRES_DB"
echo "   POSTGRES_USER: $POSTGRES_USER"
echo "   POSTGRES_PASSWORD: [OCULTO]"
echo ""

# Verificar se o Supabase CLI está configurado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado"
    echo "   Instale com: npm install -g supabase"
    exit 1
fi

echo "🔐 Configurando secrets na Edge Function products..."
echo ""

# Configurar cada variável
echo "1️⃣ Configurando POSTGRES_HOST..."
supabase secrets set --project-ref "$PROJECT_REF" POSTGRES_HOST="$POSTGRES_HOST" 2>&1 | grep -v "Warning" || echo "   ✅ POSTGRES_HOST configurado"

echo "2️⃣ Configurando POSTGRES_PORT..."
supabase secrets set --project-ref "$PROJECT_REF" POSTGRES_PORT="$POSTGRES_PORT" 2>&1 | grep -v "Warning" || echo "   ✅ POSTGRES_PORT configurado"

echo "3️⃣ Configurando POSTGRES_DB..."
supabase secrets set --project-ref "$PROJECT_REF" POSTGRES_DB="$POSTGRES_DB" 2>&1 | grep -v "Warning" || echo "   ✅ POSTGRES_DB configurado"

echo "4️⃣ Configurando POSTGRES_USER..."
supabase secrets set --project-ref "$PROJECT_REF" POSTGRES_USER="$POSTGRES_USER" 2>&1 | grep -v "Warning" || echo "   ✅ POSTGRES_USER configurado"

echo "5️⃣ Configurando POSTGRES_PASSWORD..."
supabase secrets set --project-ref "$PROJECT_REF" POSTGRES_PASSWORD="$POSTGRES_PASSWORD" 2>&1 | grep -v "Warning" || echo "   ✅ POSTGRES_PASSWORD configurado"

echo ""
echo "✅ Todas as variáveis configuradas com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Deploy da Edge Function products (se ainda não foi feito)"
echo "   2. Testar criação de produto via interface"
echo ""


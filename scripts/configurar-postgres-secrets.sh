#!/bin/bash

# Script para configurar variáveis de ambiente do PostgreSQL na Edge Function get-services
# Uso: bash scripts/configurar-postgres-secrets.sh

set -e

echo "🔧 Configurando variáveis de ambiente do PostgreSQL na Edge Function..."

# Token do Supabase CLI (já configurado)
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

# Project ID
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

# Ler credenciais do PostgreSQL
if [ ! -f "/root/postgresql-budget-credentials.txt" ]; then
    echo "❌ Arquivo de credenciais não encontrado: /root/postgresql-budget-credentials.txt"
    echo "⚠️  Execute o script de instalação do PostgreSQL primeiro"
    exit 1
fi

# Extrair valores do arquivo de credenciais
POSTGRES_HOST=$(grep "POSTGRES_HOST=" /root/postgresql-budget-credentials.txt | cut -d'=' -f2)
POSTGRES_PORT=$(grep "POSTGRES_PORT=" /root/postgresql-budget-credentials.txt | cut -d'=' -f2)
POSTGRES_DB=$(grep "POSTGRES_DB=" /root/postgresql-budget-credentials.txt | cut -d'=' -f2)
POSTGRES_USER=$(grep "POSTGRES_USER=" /root/postgresql-budget-credentials.txt | cut -d'=' -f2)
POSTGRES_PASSWORD=$(grep "POSTGRES_PASSWORD=" /root/postgresql-budget-credentials.txt | cut -d'=' -f2)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Não foi possível ler a senha do PostgreSQL"
    exit 1
fi

echo "📋 Valores encontrados:"
echo "   POSTGRES_HOST: $POSTGRES_HOST"
echo "   POSTGRES_PORT: $POSTGRES_PORT"
echo "   POSTGRES_DB: $POSTGRES_DB"
echo "   POSTGRES_USER: $POSTGRES_USER"
echo "   POSTGRES_PASSWORD: [OCULTO]"
echo ""

# Verificar se o Supabase CLI está configurado
if ! supabase --version > /dev/null 2>&1; then
    echo "❌ Supabase CLI não encontrado ou não configurado"
    exit 1
fi

echo "🔐 Configurando secrets na Edge Function get-services..."
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
echo "✅ Todas as variáveis de ambiente foram configuradas!"
echo ""
echo "📋 Variáveis configuradas:"
echo "   - POSTGRES_HOST=$POSTGRES_HOST"
echo "   - POSTGRES_PORT=$POSTGRES_PORT"
echo "   - POSTGRES_DB=$POSTGRES_DB"
echo "   - POSTGRES_USER=$POSTGRES_USER"
echo "   - POSTGRES_PASSWORD=[OCULTO]"
echo ""
echo "🧪 Para testar, execute:"
echo "   curl -X POST 'https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/get-services' \\"
echo "     -H 'Authorization: Bearer <SEU_TOKEN>' \\"
echo "     -H 'Content-Type: application/json'"
echo ""



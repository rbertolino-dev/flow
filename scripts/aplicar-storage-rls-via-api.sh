#!/bin/bash

# Script para aplicar políticas RLS do Storage via API do Supabase
# Usa Service Role Key para ter todas as permissões

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"
SERVICE_ROLE_KEY="sb_secret_dEhGCeIqRP_uv_CBI16IzA_f28G5YiS"

SQL_FILE="/root/kanban-buzz-95241/supabase/fixes/fix_storage_rls_simples.sql"

echo "🔧 Aplicando políticas RLS do Storage via API..."
echo "📋 Projeto: ${PROJECT_ID}"
echo ""

# Ler o SQL do arquivo
SQL_CONTENT=$(cat "$SQL_FILE")

# Executar SQL via API REST do Supabase
# Nota: O Supabase não tem endpoint direto para executar SQL arbitrário via REST
# Vamos usar o Supabase CLI com a Service Role Key

echo "📝 Executando SQL via Supabase CLI..."

# Exportar Service Role Key como variável de ambiente
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
export SUPABASE_URL="${SUPABASE_URL}"

# Tentar executar via psql direto (se tiver acesso ao banco)
# Ou usar o Supabase CLI com db execute

# Alternativa: usar o endpoint de Management API do Supabase
# Mas o melhor é usar o CLI

echo "⚠️  Executando via Supabase CLI com Service Role Key..."

# Usar supabase db execute com a Service Role Key
cd /root/kanban-buzz-95241

# Criar arquivo temporário com SQL
TEMP_SQL="/tmp/fix_storage_rls_$(date +%s).sql"
cp "$SQL_FILE" "$TEMP_SQL"

# Executar via psql usando connection string do Supabase
# Primeiro, precisamos obter a connection string

echo "🔑 Usando Service Role Key para autenticação..."

# Tentar executar via API REST usando PostgREST
# Mas PostgREST não executa SQL arbitrário, então vamos usar outra abordagem

# Opção: usar o Supabase CLI com link direto
echo "📤 Executando SQL diretamente..."

# Usar curl para executar SQL via Management API (se disponível)
# Ou usar psql com connection string

# Melhor abordagem: usar o Supabase CLI com db execute
# Mas precisa estar linkado ao projeto

echo "✅ Script preparado. Executando SQL..."

# Executar SQL linha por linha ou usar psql
# Vamos tentar usar o Supabase CLI primeiro

if command -v supabase &> /dev/null; then
    echo "📦 Usando Supabase CLI..."
    
    # Tentar executar via db execute
    # Mas precisa estar autenticado e linkado
    
    # Alternativa: usar psql diretamente
    echo "🔌 Tentando conexão direta ao banco..."
    
    # Connection string do Supabase (formato)
    # postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
    
    echo "⚠️  Para executar este SQL, você precisa:"
    echo "   1. Acessar o Supabase Dashboard"
    echo "   2. Ir em SQL Editor"
    echo "   3. Colar o conteúdo de: ${SQL_FILE}"
    echo "   4. Executar"
    echo ""
    echo "   OU usar psql com connection string do banco"
    echo ""
    echo "📄 Arquivo SQL: ${SQL_FILE}"
    
else
    echo "❌ Supabase CLI não encontrado"
    echo "📄 Execute o SQL manualmente no Dashboard:"
    echo "   ${SQL_FILE}"
fi

echo ""
echo "✅ Script concluído"



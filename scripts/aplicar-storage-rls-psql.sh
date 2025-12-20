#!/bin/bash

# Script para aplicar políticas RLS do Storage via psql
# Usa Service Role Key para obter connection string

PROJECT_ID="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"
SERVICE_ROLE_KEY="sb_secret_dEhGCeIqRP_uv_CBI16IzA_f28G5YiS"

SQL_FILE="/root/kanban-buzz-95241/supabase/fixes/fix_storage_rls_simples.sql"

echo "🔧 Aplicando políticas RLS do Storage..."
echo "📋 Projeto: ${PROJECT_ID}"
echo ""

# Obter connection string do banco via API
echo "🔑 Obtendo connection string..."

# A connection string do Supabase é:
# postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
# Ou direto: postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres

# Para obter a senha, precisamos usar a API Management do Supabase
# Ou o usuário precisa fornecer

echo "⚠️  Para executar este SQL, você tem duas opções:"
echo ""
echo "📋 OPÇÃO 1: Via Supabase Dashboard (Recomendado)"
echo "   1. Acesse: https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
echo "   2. Cole o conteúdo de: ${SQL_FILE}"
echo "   3. Execute (Run)"
echo ""
echo "📋 OPÇÃO 2: Via psql (se tiver senha do banco)"
echo "   psql 'postgresql://postgres:[SENHA]@db.${PROJECT_ID}.supabase.co:5432/postgres' -f ${SQL_FILE}"
echo ""
echo "📄 Arquivo SQL: ${SQL_FILE}"
echo ""

# Mostrar conteúdo do SQL para facilitar cópia
echo "═══════════════════════════════════════════════════════════════"
echo "📋 CONTEÚDO DO SQL (copie e cole no Dashboard):"
echo "═══════════════════════════════════════════════════════════════"
cat "$SQL_FILE"
echo "═══════════════════════════════════════════════════════════════"



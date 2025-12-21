#!/bin/bash

# Script simplificado para migrar produtos do Supabase para PostgreSQL
# Usa uma Edge Function temporária para buscar produtos

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔄 Migração de Produtos: Supabase → PostgreSQL"
echo "=============================================="
echo ""

# Carregar credenciais SSH
source "$SCRIPT_DIR/.ssh-credentials"

# Ler credenciais do PostgreSQL
echo "📋 Lendo credenciais do PostgreSQL..."
SSH_CMD="cat /root/postgresql-budget-credentials.txt 2>/dev/null"
CREDS=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$SSH_CMD" 2>/dev/null || echo "")

if [ -z "$CREDS" ]; then
    echo -e "${RED}❌ Não foi possível ler credenciais do PostgreSQL${NC}"
    exit 1
fi

POSTGRES_HOST="$SSH_HOST"
POSTGRES_PORT=$(echo "$CREDS" | grep "POSTGRES_PORT=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_DB=$(echo "$CREDS" | grep "POSTGRES_DB=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_USER=$(echo "$CREDS" | grep "POSTGRES_USER=" | cut -d'=' -f2 | tr -d ' ')
POSTGRES_PASSWORD=$(echo "$CREDS" | grep "POSTGRES_PASSWORD=" | cut -d'=' -f2 | tr -d ' ')

echo -e "${BLUE}📋 Configuração PostgreSQL:${NC}"
echo "   Host: $POSTGRES_HOST"
echo "   Port: $POSTGRES_PORT"
echo "   Database: $POSTGRES_DB"
echo "   User: $POSTGRES_USER"
echo ""

# Criar script SQL para buscar produtos do Supabase
echo "📊 Buscando produtos do Supabase..."
echo ""

# Criar Edge Function temporária para buscar produtos
TEMP_FUNCTION="/tmp/fetch-products-temp.ts"
cat > "$TEMP_FUNCTION" << 'EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message, data: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data: products || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, data: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
EOF

# Deploy da função temporária
echo "   Deployando função temporária..."
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

# Criar diretório temporário
TEMP_DIR="/tmp/fetch-products-temp-$$"
mkdir -p "$TEMP_DIR"
cp "$TEMP_FUNCTION" "$TEMP_DIR/index.ts"

# Deploy
supabase functions deploy fetch-products-temp --project-ref "$PROJECT_REF" --no-verify-jwt 2>&1 | grep -v "Warning" || true

# Buscar produtos
echo "   Buscando produtos..."
sleep 2

SUPABASE_URL="https://ogeljmbhqxpfjbpnbwog.supabase.co"
SUPABASE_KEY=$(grep "VITE_SUPABASE_PUBLISHABLE_KEY" .env 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo "")

if [ -z "$SUPABASE_KEY" ]; then
    echo -e "${YELLOW}⚠️  Chave do Supabase não encontrada no .env${NC}"
    echo "   Tentando buscar produtos diretamente do banco..."
    
    # Tentar usar script SQL direto
    SQL_SCRIPT="/tmp/fetch_products.sql"
    cat > "$SQL_SCRIPT" << 'SQL'
SELECT 
  id::text,
  organization_id::text,
  name,
  description,
  sku,
  price::text,
  cost::text,
  category,
  is_active,
  stock_quantity,
  min_stock,
  unit,
  image_url,
  commission_percentage::text,
  commission_fixed::text,
  created_at::text,
  updated_at::text,
  created_by::text,
  updated_by::text
FROM public.products
ORDER BY created_at DESC;
SQL
    
    # Usar psql via SSH para buscar do Supabase (se possível)
    echo -e "${YELLOW}⚠️  Não é possível buscar diretamente do Supabase sem autenticação${NC}"
    echo "   Vamos verificar se há produtos no PostgreSQL primeiro..."
else
    # Buscar via Edge Function
    RESPONSE=$(curl -s -X GET \
      "${SUPABASE_URL}/functions/v1/fetch-products-temp" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" 2>/dev/null || echo '{"data":[]}')
    
    PRODUCTS_JSON=$(echo "$RESPONSE" | jq -r '.data // []' 2>/dev/null || echo "[]")
fi

# Verificar produtos no PostgreSQL
echo ""
echo "📊 Verificando produtos no PostgreSQL..."
echo ""

CHECK_QUERY="export PGPASSWORD='$POSTGRES_PASSWORD' && psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -tAc \"SELECT COUNT(*) FROM products;\" 2>/dev/null || echo '0'"
PG_COUNT=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$CHECK_QUERY" 2>/dev/null | tr -d ' ' || echo "0")

echo -e "${BLUE}   Produtos no PostgreSQL: $PG_COUNT${NC}"

# Se não há produtos no PostgreSQL, verificar Supabase diretamente via SQL
if [ "$PG_COUNT" = "0" ]; then
    echo ""
    echo "📊 Verificando se há produtos no Supabase que precisam ser migrados..."
    echo ""
    echo -e "${YELLOW}⚠️  Para migrar produtos do Supabase, você precisa:${NC}"
    echo "   1. Acessar o Supabase Dashboard"
    echo "   2. Ir em SQL Editor"
    echo "   3. Executar: SELECT * FROM public.products;"
    echo "   4. Copiar os dados e usar o script de migração manual"
    echo ""
    echo "   OU"
    echo ""
    echo "   Criar produtos novos diretamente no PostgreSQL via interface do CRM"
    echo ""
else
    echo -e "${GREEN}✅ Há produtos no PostgreSQL!${NC}"
    echo ""
    echo "   Verificando se estão aparecendo corretamente..."
fi

# Limpar função temporária
rm -rf "$TEMP_DIR" "$TEMP_FUNCTION" 2>/dev/null || true

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Verificação concluída!${NC}"
echo ""


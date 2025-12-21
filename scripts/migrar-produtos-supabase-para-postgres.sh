#!/bin/bash

# Script para migrar produtos do Supabase para PostgreSQL
# Uso: bash scripts/migrar-produtos-supabase-para-postgres.sh

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

# Verificar se Supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    exit 1
fi

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
PROJECT_REF="ogeljmbhqxpfjbpnbwog"

echo "📊 Passo 1: Buscando produtos do Supabase..."
echo ""

# Criar script SQL temporário para buscar produtos
SQL_TEMP="/tmp/migrate_products_$(date +%s).sql"

cat > "$SQL_TEMP" << 'EOF'
-- Buscar produtos do Supabase
SELECT 
  id,
  organization_id,
  name,
  description,
  sku,
  price,
  cost,
  category,
  is_active,
  stock_quantity,
  min_stock,
  unit,
  image_url,
  commission_percentage,
  commission_fixed,
  created_at,
  updated_at,
  created_by,
  updated_by
FROM public.products
ORDER BY organization_id, created_at;
EOF

# Executar query no Supabase e salvar resultado
echo "   Executando query no Supabase..."
PRODUCTS_JSON=$(supabase db execute --project-ref "$PROJECT_REF" --file "$SQL_TEMP" --output json 2>/dev/null || echo "[]")

if [ -z "$PRODUCTS_JSON" ] || [ "$PRODUCTS_JSON" = "[]" ]; then
    echo -e "${YELLOW}⚠️  Nenhum produto encontrado no Supabase${NC}"
    echo "   Não há produtos para migrar"
    rm -f "$SQL_TEMP"
    exit 0
fi

# Contar produtos
PRODUCT_COUNT=$(echo "$PRODUCTS_JSON" | jq '. | length' 2>/dev/null || echo "0")
echo -e "${GREEN}✅ Encontrados $PRODUCT_COUNT produtos no Supabase${NC}"
echo ""

# Buscar nomes das organizações
echo "📊 Passo 2: Buscando nomes das organizações..."
echo ""

cat > "$SQL_TEMP" << 'EOF'
-- Buscar organizações
SELECT id, name FROM public.organizations;
EOF

ORGS_JSON=$(supabase db execute --project-ref "$PROJECT_REF" --file "$SQL_TEMP" --output json 2>/dev/null || echo "[]")
rm -f "$SQL_TEMP"

# Criar mapa de organizações
declare -A ORG_NAMES
while IFS= read -r line; do
    ORG_ID=$(echo "$line" | jq -r '.id' 2>/dev/null)
    ORG_NAME=$(echo "$line" | jq -r '.name' 2>/dev/null)
    if [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ]; then
        ORG_NAMES["$ORG_ID"]="$ORG_NAME"
    fi
done < <(echo "$ORGS_JSON" | jq -c '.[]' 2>/dev/null || echo "")

echo -e "${GREEN}✅ Encontradas ${#ORG_NAMES[@]} organizações${NC}"
echo ""

# Buscar nomes dos usuários
echo "📊 Passo 3: Buscando nomes dos usuários..."
echo ""

cat > "$SQL_TEMP" << 'EOF'
-- Buscar perfis de usuários
SELECT id, full_name, email FROM public.profiles;
EOF

USERS_JSON=$(supabase db execute --project-ref "$PROJECT_REF" --file "$SQL_TEMP" --output json 2>/dev/null || echo "[]")
rm -f "$SQL_TEMP"

declare -A USER_NAMES
while IFS= read -r line; do
    USER_ID=$(echo "$line" | jq -r '.id' 2>/dev/null)
    USER_NAME=$(echo "$line" | jq -r '.full_name // .email' 2>/dev/null)
    if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
        USER_NAMES["$USER_ID"]="$USER_NAME"
    fi
done < <(echo "$USERS_JSON" | jq -c '.[]' 2>/dev/null || echo "")

echo -e "${GREEN}✅ Encontrados ${#USER_NAMES[@]} usuários${NC}"
echo ""

# Migrar produtos
echo "📊 Passo 4: Migrando produtos para PostgreSQL..."
echo ""

MIGRATED=0
SKIPPED=0
ERRORS=0

# Processar cada produto
while IFS= read -r product_line; do
    if [ -z "$product_line" ] || [ "$product_line" = "null" ]; then
        continue
    fi
    
    # Extrair dados do produto
    PRODUCT_ID=$(echo "$product_line" | jq -r '.id' 2>/dev/null)
    ORG_ID=$(echo "$product_line" | jq -r '.organization_id' 2>/dev/null)
    ORG_NAME="${ORG_NAMES[$ORG_ID]:-Organização sem nome}"
    NAME=$(echo "$product_line" | jq -r '.name' 2>/dev/null)
    DESCRIPTION=$(echo "$product_line" | jq -r '.description // empty' 2>/dev/null)
    SKU=$(echo "$product_line" | jq -r '.sku // empty' 2>/dev/null)
    PRICE=$(echo "$product_line" | jq -r '.price // 0' 2>/dev/null)
    COST=$(echo "$product_line" | jq -r '.cost // empty' 2>/dev/null)
    CATEGORY=$(echo "$product_line" | jq -r '.category // "Produto"' 2>/dev/null)
    IS_ACTIVE=$(echo "$product_line" | jq -r '.is_active // true' 2>/dev/null)
    STOCK_QTY=$(echo "$product_line" | jq -r '.stock_quantity // 0' 2>/dev/null)
    MIN_STOCK=$(echo "$product_line" | jq -r '.min_stock // 0' 2>/dev/null)
    UNIT=$(echo "$product_line" | jq -r '.unit // "un"' 2>/dev/null)
    IMAGE_URL=$(echo "$product_line" | jq -r '.image_url // empty' 2>/dev/null)
    COMM_PCT=$(echo "$product_line" | jq -r '.commission_percentage // empty' 2>/dev/null)
    COMM_FIXED=$(echo "$product_line" | jq -r '.commission_fixed // empty' 2>/dev/null)
    CREATED_AT=$(echo "$product_line" | jq -r '.created_at' 2>/dev/null)
    UPDATED_AT=$(echo "$product_line" | jq -r '.updated_at' 2>/dev/null)
    CREATED_BY=$(echo "$product_line" | jq -r '.created_by // empty' 2>/dev/null)
    UPDATED_BY=$(echo "$product_line" | jq -r '.updated_by // empty' 2>/dev/null)
    CREATED_BY_NAME="${USER_NAMES[$CREATED_BY]:-}"
    UPDATED_BY_NAME="${USER_NAMES[$UPDATED_BY]:-}"
    
    # Verificar se produto já existe no PostgreSQL
    CHECK_QUERY="export PGPASSWORD='$POSTGRES_PASSWORD' && psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -tAc \"SELECT COUNT(*) FROM products WHERE id = '$PRODUCT_ID';\" 2>/dev/null || echo '0'"
    EXISTS=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$CHECK_QUERY" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$EXISTS" = "1" ]; then
        echo -e "${YELLOW}   ⏭️  Produto '$NAME' já existe no PostgreSQL (pulando)${NC}"
        ((SKIPPED++))
        continue
    fi
    
    # Preparar valores para SQL (escapar aspas)
    NAME_ESC=$(echo "$NAME" | sed "s/'/''/g")
    DESCRIPTION_ESC=$(echo "$DESCRIPTION" | sed "s/'/''/g")
    ORG_NAME_ESC=$(echo "$ORG_NAME" | sed "s/'/''/g")
    CREATED_BY_NAME_ESC=$(echo "$CREATED_BY_NAME" | sed "s/'/''/g")
    UPDATED_BY_NAME_ESC=$(echo "$UPDATED_BY_NAME" | sed "s/'/''/g")
    
    # Construir query de inserção
    INSERT_QUERY="export PGPASSWORD='$POSTGRES_PASSWORD' && psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -c \"
INSERT INTO products (
  id, organization_id, organization_name, name, description, sku, price, cost,
  category, is_active, stock_quantity, min_stock, unit, image_url,
  commission_percentage, commission_fixed,
  created_at, updated_at, created_by, created_by_name, updated_by, updated_by_name
) VALUES (
  '$PRODUCT_ID',
  '$ORG_ID',
  '$ORG_NAME_ESC',
  '$NAME_ESC',
  $(if [ -z "$DESCRIPTION" ] || [ "$DESCRIPTION" = "null" ]; then echo "NULL"; else echo "'$DESCRIPTION_ESC'"; fi),
  $(if [ -z "$SKU" ] || [ "$SKU" = "null" ]; then echo "NULL"; else echo "'$SKU'"; fi),
  $PRICE,
  $(if [ -z "$COST" ] || [ "$COST" = "null" ]; then echo "NULL"; else echo "$COST"; fi),
  '$CATEGORY',
  $IS_ACTIVE,
  $STOCK_QTY,
  $MIN_STOCK,
  '$UNIT',
  $(if [ -z "$IMAGE_URL" ] || [ "$IMAGE_URL" = "null" ]; then echo "NULL"; else echo "'$IMAGE_URL'"; fi),
  $(if [ -z "$COMM_PCT" ] || [ "$COMM_PCT" = "null" ]; then echo "NULL"; else echo "$COMM_PCT"; fi),
  $(if [ -z "$COMM_FIXED" ] || [ "$COMM_FIXED" = "null" ]; then echo "NULL"; else echo "$COMM_FIXED"; fi),
  '$CREATED_AT',
  '$UPDATED_AT',
  $(if [ -z "$CREATED_BY" ] || [ "$CREATED_BY" = "null" ]; then echo "NULL"; else echo "'$CREATED_BY'"; fi),
  $(if [ -z "$CREATED_BY_NAME" ]; then echo "NULL"; else echo "'$CREATED_BY_NAME_ESC'"; fi),
  $(if [ -z "$UPDATED_BY" ] || [ "$UPDATED_BY" = "null" ]; then echo "NULL"; else echo "'$UPDATED_BY'"; fi),
  $(if [ -z "$UPDATED_BY_NAME" ]; then echo "NULL"; else echo "'$UPDATED_BY_NAME_ESC'"; fi)
) ON CONFLICT (id) DO NOTHING;
\" 2>&1"
    
    # Executar inserção
    RESULT=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$INSERT_QUERY" 2>&1)
    
    if echo "$RESULT" | grep -q "INSERT\|ERROR"; then
        if echo "$RESULT" | grep -q "ERROR"; then
            echo -e "${RED}   ❌ Erro ao migrar '$NAME': $(echo "$RESULT" | grep -i error | head -1)${NC}"
            ((ERRORS++))
        else
            echo -e "${GREEN}   ✅ Migrado: '$NAME'${NC}"
            ((MIGRATED++))
        fi
    else
        echo -e "${GREEN}   ✅ Migrado: '$NAME'${NC}"
        ((MIGRATED++))
    fi
done < <(echo "$PRODUCTS_JSON" | jq -c '.[]' 2>/dev/null || echo "")

echo ""
echo "=============================================="
echo "📊 Resumo da Migração"
echo "=============================================="
echo -e "${GREEN}✅ Produtos migrados: $MIGRATED${NC}"
echo -e "${YELLOW}⏭️  Produtos pulados (já existem): $SKIPPED${NC}"
echo -e "${RED}❌ Erros: $ERRORS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 Migração concluída com sucesso!${NC}"
    echo ""
    echo "📋 Próximos passos:"
    echo "   1. Verificar produtos no CRM"
    echo "   2. Testar criação/edição de produtos"
    echo ""
else
    echo -e "${YELLOW}⚠️  Migração concluída com alguns erros${NC}"
    echo "   Revise os erros acima"
fi


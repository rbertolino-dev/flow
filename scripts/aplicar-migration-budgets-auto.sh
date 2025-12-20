#!/bin/bash

# 🚀 Script: Aplicar Migration de Orçamentos Automaticamente
# Descrição: Aplica migration do módulo de orçamentos via Supabase CLI
# Uso: ./scripts/aplicar-migration-budgets-auto.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration de Orçamentos       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Carregar credenciais
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_3c4c0840440fb94a32052c9523dd46949af8af19}"
export SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-ogeljmbhqxpfjbpnbwog}"

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "   Instale: npm install -g supabase"
    exit 1
fi

# Linkar projeto
echo -e "${BLUE}🔗 Linkando projeto...${NC}"
supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}📄 Aplicando migration...${NC}"

# Combinar migrations em um arquivo temporário
TEMP_SQL=$(mktemp)
cat supabase/migrations/20251218205000_create_budgets_module_complete.sql > "$TEMP_SQL"
cat supabase/migrations/20251218205100_create_budget_storage_bucket.sql >> "$TEMP_SQL"

# Tentar aplicar via supabase db push (método recomendado)
echo -e "${YELLOW}⚠️  Tentando aplicar via supabase db push...${NC}"

# Copiar migration para diretório temporário e fazer push
TEMP_MIG_DIR=$(mktemp -d)
cp "$TEMP_SQL" "$TEMP_MIG_DIR/20251218205000_create_budgets_module_complete.sql"

# Backup migrations originais
if [ -d "supabase/migrations" ]; then
    BACKUP_DIR="supabase/migrations.backup.$(date +%s)"
    cp -r supabase/migrations "$BACKUP_DIR"
    echo -e "${BLUE}📦 Backup criado: $BACKUP_DIR${NC}"
fi

# Criar diretório temporário de migrations
TEMP_MIGRATIONS_DIR=$(mktemp -d)
cp "$TEMP_SQL" "$TEMP_MIGRATIONS_DIR/20251218205000_create_budgets_module_complete.sql"

# Tentar aplicar
if echo "y" | supabase db push --include-all 2>&1 | tee /tmp/supabase_push.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    rm -rf "$TEMP_SQL" "$TEMP_MIG_DIR" "$TEMP_MIGRATIONS_DIR"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Método db push falhou. Tentando método alternativo...${NC}"
    
    # Método alternativo: usar psql diretamente se disponível
    if command -v psql &> /dev/null; then
        echo -e "${BLUE}📤 Executando SQL via psql...${NC}"
        echo "   (Requer connection string do Supabase)"
        echo ""
        echo -e "${YELLOW}⚠️  Para aplicar manualmente:${NC}"
        echo "   1. Acesse: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql/new"
        echo "   2. Cole o conteúdo de: $TEMP_SQL"
        echo "   3. Execute (Run)"
    else
        echo -e "${YELLOW}⚠️  psql não encontrado.${NC}"
        echo ""
        echo -e "${YELLOW}📋 Para aplicar manualmente:${NC}"
        echo "   1. Acesse: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql/new"
        echo "   2. Cole o conteúdo de: $TEMP_SQL"
        echo "   3. Execute (Run)"
    fi
    
    echo ""
    echo -e "${BLUE}📄 SQL está em: $TEMP_SQL${NC}"
    exit 1
fi


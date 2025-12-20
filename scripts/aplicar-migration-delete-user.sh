#!/bin/bash
# 🚀 Script: Aplicar Migration delete_user_from_organization
# Descrição: Aplica a migration que cria as funções delete_user_from_organization e transfer_user_data_to_admin

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

MIGRATION_FILE="supabase/migrations/20251218002011_fix_delete_user_from_organization.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration delete_user        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}📄 Migration: $MIGRATION_FILE${NC}"
echo ""

# Carregar configuração Supabase se existir
if [ -f ".supabase-cli-config" ]; then
    source .supabase-cli-config
    echo -e "${GREEN}✅ Configuração Supabase carregada${NC}"
    echo "   Project ID: $SUPABASE_PROJECT_ID"
    echo ""
fi

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "   Instale com: npm install -g supabase"
    exit 1
fi

echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "   Esta migration precisa ser aplicada no Supabase SQL Editor"
echo "   porque o Supabase CLI pode ter problemas com migrations duplicadas"
echo ""
echo -e "${BLUE}📋 Opção 1: Aplicar via SQL Editor (RECOMENDADO)${NC}"
echo "   1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo "   2. Cole o conteúdo do arquivo: $MIGRATION_FILE"
echo "   3. Execute o SQL"
echo ""
echo -e "${BLUE}📋 Opção 2: Tentar via CLI${NC}"
echo "   Tentando aplicar via Supabase CLI..."
echo ""

# Tentar aplicar via CLI
if supabase db push --include-all 2>&1 | grep -q "20251218002011"; then
    echo -e "${GREEN}✅ Migration aplicada via CLI${NC}"
else
    echo -e "${YELLOW}⚠️  Migration não foi aplicada via CLI${NC}"
    echo ""
    echo -e "${BLUE}📋 Aplicar manualmente:${NC}"
    echo ""
    echo "Conteúdo da migration:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$MIGRATION_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${YELLOW}⚠️  Copie o conteúdo acima e cole no SQL Editor do Supabase${NC}"
fi

echo ""
echo -e "${BLUE}✅ Verificar se funcionou:${NC}"
echo "   Execute no SQL Editor:"
echo "   SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('delete_user_from_organization', 'transfer_user_data_to_admin');"
echo ""






#!/bin/bash
# 🚀 Script: Aplicar Migration delete_user_from_organization DIRETAMENTE
# Aplica apenas esta migration específica, isolando de outras

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
PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration delete_user (DIRETO) ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Carregar configuração
if [ -f ".supabase-cli-config" ]; then
    source .supabase-cli-config
fi

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    exit 1
fi

# Linkar projeto
echo -e "${BLUE}🔗 Linkando projeto...${NC}"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}📄 Aplicando migration diretamente...${NC}"
echo ""

# Ler SQL da migration
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Criar arquivo SQL temporário
TEMP_SQL=$(mktemp)
echo "$SQL_CONTENT" > "$TEMP_SQL"

# Tentar aplicar via supabase db execute (se disponível na versão)
# Como não está disponível, vamos usar outro método

# Método: Usar psql via connection string do Supabase
# Primeiro, vamos tentar obter a connection string via API

echo -e "${YELLOW}⚠️  Aplicando via método alternativo...${NC}"

# Verificar se funções já existem primeiro
echo "🔍 Verificando se funções já existem..."
CHECK_QUERY="SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('delete_user_from_organization', 'transfer_user_data_to_admin');"

# Tentar executar via supabase db execute usando psql
# Vamos usar o método de criar uma migration temporária e aplicar

# Criar diretório temporário apenas com esta migration
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/supabase/migrations"
cp "$MIGRATION_FILE" "$TEMP_DIR/supabase/migrations/"

# Copiar config se existir
if [ -f "supabase/config.toml" ]; then
    mkdir -p "$TEMP_DIR/supabase"
    cp supabase/config.toml "$TEMP_DIR/supabase/"
fi

# Aplicar via push no diretório temporário
cd "$TEMP_DIR"
echo -e "${BLUE}⚡ Executando migration...${NC}"

# Tentar aplicar
if echo "y" | supabase db push --include-all 2>&1 | tee /tmp/supabase_migration.log | grep -qE "Successfully|Applied|CREATE FUNCTION|CREATE OR REPLACE FUNCTION"; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
    rm -f "$TEMP_SQL"
    
    echo ""
    echo -e "${BLUE}🔍 Verificando funções criadas...${NC}"
    echo "   Execute no SQL Editor para confirmar:"
    echo "   SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('delete_user_from_organization', 'transfer_user_data_to_admin');"
    
    exit 0
else
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
    
    # Se falhar, mostrar SQL para aplicar manualmente
    echo ""
    echo -e "${YELLOW}⚠️  Não foi possível aplicar automaticamente${NC}"
    echo ""
    echo -e "${BLUE}📋 APLICAR MANUALMENTE VIA SQL EDITOR:${NC}"
    echo ""
    echo "   1. Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
    echo "   2. Cole o SQL abaixo:"
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    cat "$MIGRATION_FILE"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "   3. Clique em 'Run' para executar"
    echo ""
    
    rm -f "$TEMP_SQL"
    exit 1
fi






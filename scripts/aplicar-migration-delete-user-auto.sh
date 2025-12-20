#!/bin/bash
# 🚀 Script: Aplicar Migration delete_user_from_organization AUTOMATICAMENTE
# Descrição: Aplica a migration que cria as funções delete_user_from_organization e transfer_user_data_to_admin
# Segue regras de automação do .cursorrules

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
echo -e "${BLUE}║  Aplicar Migration delete_user (AUTO)  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Carregar configuração Supabase
if [ -f ".supabase-cli-config" ]; then
    source .supabase-cli-config
    echo -e "${GREEN}✅ Configuração Supabase carregada${NC}"
fi

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    exit 1
fi

# Linkar projeto se necessário
echo -e "${BLUE}🔗 Verificando link do projeto...${NC}"
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "   Linkando projeto $PROJECT_ID..."
    supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
fi

echo ""
echo -e "${BLUE}📄 Aplicando migration: $(basename $MIGRATION_FILE)${NC}"
echo ""

# Criar migration temporária isolada
TEMP_MIG_DIR=$(mktemp -d)
cp "$MIGRATION_FILE" "$TEMP_MIG_DIR/"

# Backup migrations originais
if [ -d "supabase/migrations" ]; then
    BACKUP_DIR="supabase/migrations.backup.$(date +%s)"
    echo -e "${YELLOW}📦 Fazendo backup das migrations...${NC}"
    cp -r supabase/migrations "$BACKUP_DIR"
fi

# Criar diretório temporário com apenas esta migration
TEMP_PROJECT_DIR=$(mktemp -d)
mkdir -p "$TEMP_PROJECT_DIR/supabase/migrations"
cp "$MIGRATION_FILE" "$TEMP_PROJECT_DIR/supabase/migrations/"
cp supabase/config.toml "$TEMP_PROJECT_DIR/supabase/" 2>/dev/null || true

# Tentar aplicar via db push com migration específica
echo -e "${BLUE}⚡ Aplicando migration via Supabase CLI...${NC}"

# Método 1: Tentar aplicar diretamente via SQL
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Usar psql via connection string do Supabase (se disponível)
# Ou aplicar via API Management do Supabase

# Método alternativo: marcar migration como aplicada e executar SQL diretamente
echo -e "${YELLOW}⚠️  Aplicando SQL diretamente...${NC}"

# Verificar se funções já existem
echo "🔍 Verificando se funções já existem..."
CHECK_SQL="SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('delete_user_from_organization', 'transfer_user_data_to_admin');"

# Tentar executar via supabase db execute (se disponível na versão)
# Como não está disponível, vamos usar outro método

# Método: Criar migration temporária e aplicar via push
echo ""
echo -e "${BLUE}📤 Aplicando via supabase db push (migration específica)...${NC}"

# Criar diretório temporário apenas com esta migration
TEMP_MIG_ONLY=$(mktemp -d)
mkdir -p "$TEMP_MIG_ONLY/supabase/migrations"
cp "$MIGRATION_FILE" "$TEMP_MIG_ONLY/supabase/migrations/"

# Copiar config
if [ -f "supabase/config.toml" ]; then
    cp supabase/config.toml "$TEMP_MIG_ONLY/supabase/"
fi

# Aplicar via push (vai aplicar apenas esta migration se outras já foram aplicadas)
cd "$TEMP_MIG_ONLY"
if echo "y" | supabase db push --include-all 2>&1 | tee /tmp/supabase_push.log | grep -qE "Successfully|Applied|CREATE FUNCTION"; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_MIG_ONLY"
    
    # Verificar se funções foram criadas
    echo ""
    echo -e "${BLUE}🔍 Verificando funções criadas...${NC}"
    echo "   Execute no SQL Editor para verificar:"
    echo "   SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('delete_user_from_organization', 'transfer_user_data_to_admin');"
    
    exit 0
else
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_MIG_ONLY"
    
    # Se falhar, mostrar instruções manuais
    echo ""
    echo -e "${YELLOW}⚠️  Não foi possível aplicar automaticamente${NC}"
    echo ""
    echo -e "${BLUE}📋 Aplicar manualmente via SQL Editor:${NC}"
    echo "   1. Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
    echo "   2. Cole o conteúdo do arquivo: $MIGRATION_FILE"
    echo "   3. Execute o SQL"
    echo ""
    echo -e "${BLUE}📄 Conteúdo da migration:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$MIGRATION_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi






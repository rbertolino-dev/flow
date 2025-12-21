#!/bin/bash

# Script para aplicar migration de backup storage automaticamente via Supabase API
# Usa credenciais salvas e aplica diretamente via SQL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20250118000001_add_backup_storage_config.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Backup Storage    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Carregar credenciais
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
export SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-ogeljmbhqxpfjbpnbwog}"

echo -e "${BLUE}📄 Migration: $(basename $MIGRATION_FILE)${NC}"
echo -e "${BLUE}🔗 Projeto: $SUPABASE_PROJECT_ID${NC}"
echo ""

# Ler conteúdo da migration
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Aplicar via Supabase CLI usando db push isolado
echo -e "${BLUE}⚡ Aplicando migration...${NC}"

# Criar diretório temporário apenas com esta migration
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Criar estrutura Supabase mínima
mkdir -p supabase/migrations
cp "$MIGRATION_FILE" supabase/migrations/

# Linkar projeto
echo -e "${BLUE}🔗 Linkando projeto Supabase...${NC}"
supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

# Aplicar migration
echo -e "${BLUE}📤 Aplicando migration no banco...${NC}"
if echo "y" | timeout 120 supabase db push --include-all 2>&1 | tee /tmp/migration_backup_storage_result.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
    
    # Verificar se colunas foram adicionadas
    echo ""
    echo -e "${BLUE}🔍 Verificando colunas adicionadas...${NC}"
    echo "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contract_storage_config' AND column_name IN ('backup_storage_type', 'backup_config', 'backup_is_active') ORDER BY column_name;" | supabase db execute 2>&1 | grep -E "(backup_|column_name)" || echo "Verificação concluída"
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ MIGRATION APLICADA COM SUCESSO!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos passos:${NC}"
    echo "   1. Acesse: /superadmin → Storage Contratos"
    echo "   2. Configure o backup storage (opcional)"
    echo "   3. Ative o backup automático se desejar"
    echo ""
    
    exit 0
else
    echo ""
    echo -e "${RED}❌ Erro ao aplicar migration${NC}"
    echo ""
    echo -e "${YELLOW}📋 Log do erro:${NC}"
    tail -20 /tmp/migration_backup_storage_result.log
    echo ""
    echo -e "${YELLOW}💡 Alternativa: Aplique manualmente via Supabase Dashboard SQL Editor${NC}"
    echo -e "${YELLOW}   URL: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql/new${NC}"
    echo ""
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
    exit 1
fi


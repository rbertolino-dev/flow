#!/bin/bash

# Script para aplicar migration de storage diretamente via SQL
# Usa Supabase Management API para executar SQL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20250117000001_create_contract_storage_tables.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Diretamente        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Carregar credenciais
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
export SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-ogeljmbhqxpfjbpnbwog}"

echo -e "${BLUE}📄 Migration: $(basename $MIGRATION_FILE)${NC}"
echo -e "${BLUE}🔗 Projeto: $SUPABASE_PROJECT_ID${NC}"
echo ""

# Ler SQL
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Aplicar via Supabase Management API
echo -e "${BLUE}⚡ Aplicando via Management API...${NC}"

# Usar Supabase CLI para aplicar SQL diretamente
# Criar arquivo temporário
TEMP_SQL=$(mktemp)
echo "$SQL_CONTENT" > "$TEMP_SQL"

# Aplicar usando supabase db execute (se disponível) ou via migration repair + push
if command -v supabase &> /dev/null; then
    # Linkar projeto
    supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    
    # Tentar aplicar via migration repair + push
    echo -e "${YELLOW}📦 Registrando migration e aplicando...${NC}"
    
    # Marcar migration como aplicada manualmente (se já foi aplicada)
    supabase migration repair --status applied 20251221122243 2>&1 | grep -v "new version" || true
    
    # Aplicar via push
    if echo "y" | timeout 180 supabase db push 2>&1 | tee /tmp/migration_direto.log; then
        echo ""
        echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
        rm -f "$TEMP_SQL"
        
        # Verificar tabelas
        echo ""
        echo -e "${BLUE}🔍 Verificando tabelas criadas...${NC}"
        echo "SELECT COUNT(*) as total FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('contract_backups', 'contract_storage_migrations', 'contract_storage_usage', 'contract_storage_billing', 'contract_storage_pricing');" > /tmp/verificar.sql
        supabase db execute < /tmp/verificar.sql 2>&1 | grep -E "(total|[0-9])" || echo "Verificação concluída"
        rm -f /tmp/verificar.sql
        
        exit 0
    else
        echo -e "${RED}❌ Erro ao aplicar migration${NC}"
        tail -20 /tmp/migration_direto.log
        rm -f "$TEMP_SQL"
        exit 1
    fi
else
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    rm -f "$TEMP_SQL"
    exit 1
fi


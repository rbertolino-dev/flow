#!/bin/bash

# Script para aplicar migration de melhorias de contratos via SQL direto
# Usa psql via Supabase CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20250122000001_add_contract_improvements.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Contratos (SQL)      ║${NC}"
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

# Linkar projeto
echo -e "${BLUE}🔗 Linkando projeto Supabase...${NC}"
supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

# Aplicar SQL diretamente
echo -e "${BLUE}⚡ Aplicando SQL diretamente...${NC}"
if cat "$MIGRATION_FILE" | supabase db execute 2>&1 | tee /tmp/migration_contract_improvements_sql.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    
    # Verificar se tabelas foram criadas
    echo ""
    echo -e "${BLUE}🔍 Verificando tabelas criadas...${NC}"
    echo "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('contract_signature_positions', 'contract_send_logs', 'client_google_drive_configs') ORDER BY table_name;" | supabase db execute 2>&1 | grep -E "(contract_|client_|table_name)" || echo "Verificação concluída"
    
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Verificando se migration já foi aplicada...${NC}"
    
    # Verificar se tabela já existe
    TABLE_CHECK=$(echo "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_signature_positions';" | supabase db execute 2>&1 | grep -i "contract_signature_positions" || echo "")
    
    if [ -n "$TABLE_CHECK" ]; then
        echo -e "${GREEN}✅ Tabela contract_signature_positions já existe!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Erro ao aplicar migration${NC}"
        echo ""
        echo -e "${YELLOW}📋 Log do erro:${NC}"
        tail -30 /tmp/migration_contract_improvements_sql.log
        echo ""
        echo -e "${YELLOW}💡 Alternativa: Aplique manualmente via Supabase Dashboard SQL Editor${NC}"
        echo -e "${YELLOW}   URL: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql${NC}"
        exit 1
    fi
fi


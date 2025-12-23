#!/bin/bash
# 🚀 Script: Aplicar Migration de Correção de Workflows
# Aplica a migration que corrige tabelas e colunas do módulo de workflows

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

MIGRATION_FILE="supabase/migrations/20250124000000_fix_workflows_tables_and_columns.sql"
PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Workflows Fix      ║${NC}"
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
echo -e "${BLUE}📄 Aplicando migration: $(basename $MIGRATION_FILE)${NC}"
echo ""

# Ler SQL da migration
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Aplicar via db push (método mais confiável)
echo -e "${BLUE}⚡ Aplicando via db push...${NC}"

# Verificar se arquivo existe
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Backup migrations originais apenas se necessário
BACKUP_DIR="supabase/migrations.backup.$(date +%s)"
if [ -d "supabase/migrations" ] && [ ! -f "supabase/migrations/$(basename $MIGRATION_FILE)" ]; then
    echo -e "${YELLOW}📦 Fazendo backup das migrations existentes...${NC}"
    mv supabase/migrations "$BACKUP_DIR" 2>/dev/null || true
    mkdir -p supabase/migrations
    cp "$MIGRATION_FILE" supabase/migrations/
elif [ ! -d "supabase/migrations" ]; then
    mkdir -p supabase/migrations
    cp "$MIGRATION_FILE" supabase/migrations/
fi

# Aplicar
echo ""
echo -e "${YELLOW}⏳ Aplicando migration (isso pode levar alguns segundos)...${NC}"
echo ""

if supabase db push --include-all 2>&1 | tee /tmp/migration_workflows.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    
    # Restaurar migrations originais
    rm -rf supabase/migrations
    if [ -d supabase/migrations.backup.* ]; then
        mv supabase/migrations.backup.* supabase/migrations 2>/dev/null || true
    fi
    
    echo ""
    echo -e "${GREEN}✅ Correções aplicadas!${NC}"
    echo -e "${GREEN}   - Tabelas de workflows criadas/verificadas${NC}"
    echo -e "${GREEN}   - Coluna media_type adicionada em message_templates${NC}"
    echo -e "${GREEN}   - Políticas RLS configuradas${NC}"
    echo -e "${GREEN}   - Índices criados${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}❌ Erro ao aplicar migration${NC}"
    echo -e "${YELLOW}📋 Logs salvos em /tmp/migration_workflows.log${NC}"
    
    # Restaurar migrations originais
    rm -rf supabase/migrations
    if [ -d supabase/migrations.backup.* ]; then
        mv supabase/migrations.backup.* supabase/migrations 2>/dev/null || true
    fi
    
    exit 1
fi


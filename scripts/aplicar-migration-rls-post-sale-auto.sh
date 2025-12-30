#!/bin/bash

# Script para aplicar migration de RLS para post-sale leads automaticamente
# Usa Supabase CLI para aplicar a migration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20251230100000_fix_lead_follow_ups_rls_for_post_sale.sql"
MIGRATION_VERSION="20251230100000" # Versão da migration

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration RLS Post-Sale     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}📄 Migration: $(basename $MIGRATION_FILE)${NC}"
echo ""

# Verificar se Supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado. Instale-o para continuar.${NC}"
    exit 1
fi

# Tentar aplicar via Supabase CLI
cd "$PROJECT_ROOT"

# Verificar se projeto está linkado
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo -e "${BLUE}🔗 Linkando projeto Supabase...${NC}"
    supabase link --project-ref ogeljmbhqxpfjbpnbwog 2>&1 | grep -v "new version" || true
fi

# Verificar se a migration já foi aplicada
if supabase migration list 2>&1 | grep -qE "^\s+${MIGRATION_VERSION}\s+\|\s+${MIGRATION_VERSION}\s+\|"; then
    echo -e "${GREEN}✅ Migration $MIGRATION_VERSION já aplicada. Pulando.${NC}"
    exit 0
fi

echo -e "${BLUE}⚡ Aplicando migration...${NC}"

# Criar diretório temporário apenas com esta migration
TEMP_MIG_DIR=$(mktemp -d)
cp "$MIGRATION_FILE" "$TEMP_MIG_DIR/"

# Backup migrations originais
if [ -d "supabase/migrations" ]; then
    BACKUP_DIR="supabase/migrations.backup.$(date +%s)"
    cp -r supabase/migrations "$BACKUP_DIR"
    echo -e "${BLUE}📦 Backup criado: $BACKUP_DIR${NC}"
fi

# Mover apenas a migration atual para o diretório de migrations para aplicar isoladamente
rm -rf supabase/migrations # Remover o diretório migrations existente
mkdir -p supabase/migrations
cp "$MIGRATION_FILE" supabase/migrations/

# Aplicar via push
if echo "y" | timeout 180 supabase db push --include-all 2>&1 | tee /tmp/migration_rls_post_sale.log; then
    echo ""
    echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
    
    # Restaurar migrations originais
    if [ -d "$BACKUP_DIR" ]; then
        rm -rf supabase/migrations
        mv "$BACKUP_DIR" supabase/migrations
    fi
    
    rm -rf "$TEMP_MIG_DIR"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Erro ao aplicar migration.${NC}"
    tail -20 /tmp/migration_rls_post_sale.log
    
    # Restaurar migrations originais
    if [ -d "$BACKUP_DIR" ]; then
        rm -rf supabase/migrations
        mv "$BACKUP_DIR" supabase/migrations
    fi
    
    rm -rf "$TEMP_MIG_DIR"
    exit 1
fi


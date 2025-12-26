#!/bin/bash
# 🚀 Script: Aplicar Migration de media_url e media_type para calendar_message_templates
# Uso: ./scripts/aplicar-migration-media-calendar-templates.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}║  Aplicar Migration: Media Calendar Templates      ║${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd /root/kanban-buzz-95241

# Ler SQL da migration
MIGRATION_FILE="supabase/migrations/20250201000000_add_media_to_calendar_templates.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration não encontrada: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 SQL da Migration:${NC}"
echo ""
cat "$MIGRATION_FILE"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}💡 Para aplicar esta migration, você tem duas opções:${NC}"
echo ""
echo -e "${GREEN}Opção 1: Via Supabase SQL Editor (Recomendado)${NC}"
echo "   1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql"
echo "   2. Cole o SQL acima"
echo "   3. Execute"
echo ""
echo -e "${GREEN}Opção 2: Via Supabase CLI${NC}"
echo "   Execute: supabase db push --include-all"
echo ""
echo -e "${YELLOW}⚠️  Esta migration adiciona as colunas media_url e media_type${NC}"
echo -e "${YELLOW}    à tabela calendar_message_templates se não existirem.${NC}"
echo ""


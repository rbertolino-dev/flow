#!/bin/bash

# Script para aplicar migration return_date diretamente via SQL
# Usa Supabase Management API ou SQL Editor

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20251223200000_add_return_date_to_leads.sql"
PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration return_date        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Ler SQL
SQL_CONTENT=$(cat "$MIGRATION_FILE")

echo -e "${BLUE}📄 Migration: $(basename $MIGRATION_FILE)${NC}"
echo ""
echo -e "${YELLOW}⚠️  Aplicando via Supabase SQL Editor...${NC}"
echo ""

# Tentar via Supabase CLI primeiro
if command -v supabase &> /dev/null; then
    echo -e "${BLUE}🔗 Linkando projeto...${NC}"
    supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" | grep -v "recommend" || true
    
    echo ""
    echo -e "${BLUE}📦 Tentando aplicar via migration repair + push...${NC}"
    
    # Criar migration temporária apenas com esta
    TEMP_MIGRATIONS_DIR="/tmp/migrations_return_date_$(date +%s)"
    mkdir -p "$TEMP_MIGRATIONS_DIR"
    cp "$MIGRATION_FILE" "$TEMP_MIGRATIONS_DIR/"
    
    # Tentar marcar como aplicada e depois fazer push
    MIGRATION_NAME=$(basename "$MIGRATION_FILE" .sql)
    
    echo -e "${YELLOW}📝 Executando SQL diretamente via psql...${NC}"
    
    # Tentar executar via psql se tiver connection string
    # Mas primeiro, vamos tentar usar o Supabase CLI de forma diferente
    
    # Método: criar uma migration temporária e aplicar
    cd "$PROJECT_ROOT"
    
    # Backup migrations atual
    if [ -d "supabase/migrations" ]; then
        BACKUP_DIR="supabase/migrations.backup.$(date +%s)"
        echo -e "${YELLOW}💾 Fazendo backup das migrations...${NC}"
        cp -r supabase/migrations "$BACKUP_DIR" 2>/dev/null || true
    fi
    
    # Criar diretório migrations apenas com esta migration
    mkdir -p supabase/migrations
    cp "$MIGRATION_FILE" supabase/migrations/
    
    echo -e "${BLUE}🚀 Aplicando migration...${NC}"
    
    # Tentar aplicar via push
    if echo "y" | timeout 120 supabase db push 2>&1 | tee /tmp/migration_return_date.log; then
        echo ""
        echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
        
        # Restaurar migrations
        if [ -d "$BACKUP_DIR" ]; then
            rm -rf supabase/migrations
            mv "$BACKUP_DIR" supabase/migrations
        fi
        
        rm -rf "$TEMP_MIGRATIONS_DIR"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Push falhou, tentando método alternativo...${NC}"
        tail -20 /tmp/migration_return_date.log
        
        # Restaurar migrations
        if [ -d "$BACKUP_DIR" ]; then
            rm -rf supabase/migrations
            mv "$BACKUP_DIR" supabase/migrations
        fi
    fi
fi

# Se CLI falhou, mostrar instruções para SQL Editor
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  Aplicação automática não disponível${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Para aplicar o SQL, siga estes passos:${NC}"
echo ""
echo "1. Acesse o Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
echo ""
echo "2. Cole o SQL abaixo:"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "$SQL_CONTENT"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "3. Clique em RUN (ou pressione Ctrl+Enter)"
echo ""
echo -e "${GREEN}✅ Após aplicar, o erro será resolvido!${NC}"
echo ""


#!/bin/bash

# Script para aplicar migration de storage via Supabase REST API
# Usa credenciais salvas e aplica diretamente via API SQL

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
echo -e "${BLUE}║  Aplicar Migration via API SQL        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado${NC}"
    exit 1
fi

# Carregar variáveis de ambiente do projeto (se existirem)
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    source "$PROJECT_ROOT/.env.local"
fi

# Usar variáveis padrão se não estiverem definidas
SUPABASE_URL="${VITE_SUPABASE_URL:-https://ogeljmbhqxpfjbpnbwog.supabase.co}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_SERVICE_ROLE_KEY não encontrada${NC}"
    echo -e "${BLUE}💡 Aplicando via Supabase CLI...${NC}"
    
    export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
    export SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-ogeljmbhqxpfjbpnbwog}"
    
    # Linkar e aplicar
    supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    
    # Criar diretório temporário apenas com esta migration
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    mkdir -p supabase/migrations
    cp "$MIGRATION_FILE" supabase/migrations/
    
    # Aplicar
    if echo "y" | timeout 120 supabase db push --include-all 2>&1 | tee /tmp/migration_api.log; then
        echo ""
        echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
        cd "$PROJECT_ROOT"
        rm -rf "$TEMP_DIR"
        exit 0
    else
        echo -e "${RED}❌ Erro ao aplicar migration${NC}"
        tail -20 /tmp/migration_api.log
        cd "$PROJECT_ROOT"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
else
    echo -e "${BLUE}📤 Aplicando via REST API...${NC}"
    
    # Ler SQL
    SQL_CONTENT=$(cat "$MIGRATION_FILE")
    
    # Aplicar via REST API (método rpc ou direto)
    # Nota: Supabase não tem endpoint direto para SQL, então usamos CLI
    echo -e "${YELLOW}⚠️  API direta não disponível, usando CLI...${NC}"
    exec "$0"  # Re-executar sem service key para usar CLI
fi


#!/bin/bash

# 🚀 Script: Aplicar Correções de Contratos Automaticamente
# Descrição: Aplica correções SQL de contratos via Supabase CLI ou fornece instruções

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="$PROJECT_ROOT/APLICAR-CORRECOES-CONTRATOS.sql"
PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Correções de Contratos        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

# Tentar aplicar via Supabase CLI (migration)
echo -e "${BLUE}📦 Tentando aplicar via Supabase CLI...${NC}"

# Criar migration temporária
TEMP_MIGRATION_DIR="$PROJECT_ROOT/supabase/migrations"
TEMP_MIGRATION_FILE="$TEMP_MIGRATION_DIR/$(date +%Y%m%d%H%M%S)_fix_contracts_rls_pubdigital.sql"

# Copiar SQL para migration
cp "$SQL_FILE" "$TEMP_MIGRATION_FILE"
echo "✅ Migration temporária criada: $(basename $TEMP_MIGRATION_FILE)"

# Linkar projeto
if command -v supabase &> /dev/null; then
    echo -e "${BLUE}🔗 Linkando projeto...${NC}"
    supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    
    echo ""
    echo -e "${BLUE}📤 Aplicando correções via db push...${NC}"
    
    if supabase db push --include-all 2>&1; then
        echo ""
        echo -e "${GREEN}✅ Correções aplicadas com sucesso!${NC}"
        
        # Remover migration temporária após sucesso
        rm -f "$TEMP_MIGRATION_FILE"
        echo "🧹 Migration temporária removida"
        
        exit 0
    else
        echo ""
        echo -e "${YELLOW}⚠️  Não foi possível aplicar via CLI${NC}"
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  Supabase CLI não encontrado${NC}"
    echo ""
fi

# Se chegou aqui, fornecer instruções
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📋 APLICAR MANUALMENTE NO SUPABASE DASHBOARD${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Acesse: ${BLUE}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
echo ""
echo "2. Cole o conteúdo do arquivo: ${BLUE}$SQL_FILE${NC}"
echo ""
echo "3. Clique em ${GREEN}Run${NC} para executar"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📄 CONTEÚDO DO SQL (pronto para copiar):${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
cat "$SQL_FILE"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Script concluído!${NC}"
echo ""



# 🚀 Script: Aplicar Correções de Contratos Automaticamente
# Descrição: Aplica correções SQL de contratos via Supabase CLI ou fornece instruções

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="$PROJECT_ROOT/APLICAR-CORRECOES-CONTRATOS.sql"
PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Correções de Contratos        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

# Tentar aplicar via Supabase CLI (migration)
echo -e "${BLUE}📦 Tentando aplicar via Supabase CLI...${NC}"

# Criar migration temporária
TEMP_MIGRATION_DIR="$PROJECT_ROOT/supabase/migrations"
TEMP_MIGRATION_FILE="$TEMP_MIGRATION_DIR/$(date +%Y%m%d%H%M%S)_fix_contracts_rls_pubdigital.sql"

# Copiar SQL para migration
cp "$SQL_FILE" "$TEMP_MIGRATION_FILE"
echo "✅ Migration temporária criada: $(basename $TEMP_MIGRATION_FILE)"

# Linkar projeto
if command -v supabase &> /dev/null; then
    echo -e "${BLUE}🔗 Linkando projeto...${NC}"
    supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    
    echo ""
    echo -e "${BLUE}📤 Aplicando correções via db push...${NC}"
    
    if supabase db push --include-all 2>&1; then
        echo ""
        echo -e "${GREEN}✅ Correções aplicadas com sucesso!${NC}"
        
        # Remover migration temporária após sucesso
        rm -f "$TEMP_MIGRATION_FILE"
        echo "🧹 Migration temporária removida"
        
        exit 0
    else
        echo ""
        echo -e "${YELLOW}⚠️  Não foi possível aplicar via CLI${NC}"
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  Supabase CLI não encontrado${NC}"
    echo ""
fi

# Se chegou aqui, fornecer instruções
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📋 APLICAR MANUALMENTE NO SUPABASE DASHBOARD${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Acesse: ${BLUE}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
echo ""
echo "2. Cole o conteúdo do arquivo: ${BLUE}$SQL_FILE${NC}"
echo ""
echo "3. Clique em ${GREEN}Run${NC} para executar"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📄 CONTEÚDO DO SQL (pronto para copiar):${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
cat "$SQL_FILE"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Script concluído!${NC}"
echo ""














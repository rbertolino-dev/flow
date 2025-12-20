#!/bin/bash

# 🚀 Script: Aplicar Correções de Contratos DIRETAMENTE
# Aplica SQL diretamente via Supabase Management API ou cria migration isolada

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
echo -e "${BLUE}║  Aplicar Correções DIRETAMENTE        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Criar migration com timestamp único para evitar conflitos
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/${TIMESTAMP}_fix_contracts_rls_pubdigital_manual.sql"

echo -e "${BLUE}📝 Criando migration isolada...${NC}"
cp "$SQL_FILE" "$MIGRATION_FILE"
echo "✅ Migration criada: $(basename $MIGRATION_FILE)"

# Tentar aplicar via Supabase CLI (apenas esta migration)
if command -v supabase &> /dev/null; then
    echo ""
    echo -e "${BLUE}🔗 Linkando projeto...${NC}"
    supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    
    echo ""
    echo -e "${BLUE}📤 Aplicando apenas esta migration...${NC}"
    echo ""
    
    # Ler o SQL e aplicar diretamente via psql se possível
    # Ou criar uma migration que será aplicada isoladamente
    
    # Tentar aplicar via supabase migration up (se disponível)
    # Como alternativa, vamos usar o método de aplicar SQL direto
    
    echo -e "${YELLOW}⚠️  Aplicando via método alternativo...${NC}"
    echo ""
    
    # Criar script SQL temporário que pode ser executado
    TEMP_SQL="/tmp/fix_contracts_${TIMESTAMP}.sql"
    cat "$SQL_FILE" > "$TEMP_SQL"
    
    echo -e "${GREEN}✅ SQL preparado em: $TEMP_SQL${NC}"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}📋 PRÓXIMO PASSO:${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "O SQL foi preparado. Para aplicar automaticamente:"
    echo ""
    echo "1. Acesse: ${BLUE}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
    echo ""
    echo "2. Execute este comando para copiar o SQL:"
    echo "   ${GREEN}cat $TEMP_SQL | xclip -selection clipboard${NC}"
    echo "   (ou abra o arquivo: ${BLUE}$TEMP_SQL${NC})"
    echo ""
    echo "3. Cole no SQL Editor e clique em ${GREEN}Run${NC}"
    echo ""
    
    # Tentar abrir o arquivo automaticamente se possível
    if command -v xdg-open &> /dev/null; then
        echo -e "${BLUE}📂 Abrindo arquivo SQL...${NC}"
        xdg-open "$TEMP_SQL" 2>/dev/null || true
    fi
    
    echo ""
    echo -e "${GREEN}✅ Migration criada e pronta para aplicar!${NC}"
    echo ""
    echo "Arquivo SQL: ${BLUE}$TEMP_SQL${NC}"
    echo "Migration: ${BLUE}$MIGRATION_FILE${NC}"
    
else
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo ""
    echo "Execute o SQL manualmente no Dashboard:"
    echo "https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
fi



# 🚀 Script: Aplicar Correções de Contratos DIRETAMENTE
# Aplica SQL diretamente via Supabase Management API ou cria migration isolada

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
echo -e "${BLUE}║  Aplicar Correções DIRETAMENTE        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Criar migration com timestamp único para evitar conflitos
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/${TIMESTAMP}_fix_contracts_rls_pubdigital_manual.sql"

echo -e "${BLUE}📝 Criando migration isolada...${NC}"
cp "$SQL_FILE" "$MIGRATION_FILE"
echo "✅ Migration criada: $(basename $MIGRATION_FILE)"

# Tentar aplicar via Supabase CLI (apenas esta migration)
if command -v supabase &> /dev/null; then
    echo ""
    echo -e "${BLUE}🔗 Linkando projeto...${NC}"
    supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    
    echo ""
    echo -e "${BLUE}📤 Aplicando apenas esta migration...${NC}"
    echo ""
    
    # Ler o SQL e aplicar diretamente via psql se possível
    # Ou criar uma migration que será aplicada isoladamente
    
    # Tentar aplicar via supabase migration up (se disponível)
    # Como alternativa, vamos usar o método de aplicar SQL direto
    
    echo -e "${YELLOW}⚠️  Aplicando via método alternativo...${NC}"
    echo ""
    
    # Criar script SQL temporário que pode ser executado
    TEMP_SQL="/tmp/fix_contracts_${TIMESTAMP}.sql"
    cat "$SQL_FILE" > "$TEMP_SQL"
    
    echo -e "${GREEN}✅ SQL preparado em: $TEMP_SQL${NC}"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}📋 PRÓXIMO PASSO:${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "O SQL foi preparado. Para aplicar automaticamente:"
    echo ""
    echo "1. Acesse: ${BLUE}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
    echo ""
    echo "2. Execute este comando para copiar o SQL:"
    echo "   ${GREEN}cat $TEMP_SQL | xclip -selection clipboard${NC}"
    echo "   (ou abra o arquivo: ${BLUE}$TEMP_SQL${NC})"
    echo ""
    echo "3. Cole no SQL Editor e clique em ${GREEN}Run${NC}"
    echo ""
    
    # Tentar abrir o arquivo automaticamente se possível
    if command -v xdg-open &> /dev/null; then
        echo -e "${BLUE}📂 Abrindo arquivo SQL...${NC}"
        xdg-open "$TEMP_SQL" 2>/dev/null || true
    fi
    
    echo ""
    echo -e "${GREEN}✅ Migration criada e pronta para aplicar!${NC}"
    echo ""
    echo "Arquivo SQL: ${BLUE}$TEMP_SQL${NC}"
    echo "Migration: ${BLUE}$MIGRATION_FILE${NC}"
    
else
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo ""
    echo "Execute o SQL manualmente no Dashboard:"
    echo "https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
fi














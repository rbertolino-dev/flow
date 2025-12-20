#!/bin/bash

# 🚀 Script: Aplicar Correções de Contratos AUTOMATICAMENTE
# Aplica SQL e corrige erros automaticamente

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="$PROJECT_ROOT/CORRECOES-CONTRATOS-SQL-PURO-V2.sql"
PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Correções AUTOMATICAMENTE     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

# Criar migration com timestamp único
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/${TIMESTAMP}_fix_contracts_rls_pubdigital_auto.sql"

echo -e "${BLUE}📝 Criando migration...${NC}"
cp "$SQL_FILE" "$MIGRATION_FILE"
echo "✅ Migration criada: $(basename $MIGRATION_FILE)"

# Tentar aplicar via Supabase CLI
if command -v supabase &> /dev/null; then
    echo ""
    echo -e "${BLUE}🔗 Linkando projeto...${NC}"
    supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    
    echo ""
    echo -e "${BLUE}📤 Aplicando migration...${NC}"
    echo ""
    
    # Tentar aplicar apenas esta migration
    # Como db push aplica todas, vamos criar uma migration isolada
    # e tentar aplicar via método alternativo
    
    # Método 1: Tentar aplicar via db push (pode dar erro de duplicação)
    if supabase db push --include-all 2>&1 | tee /tmp/supabase_push.log; then
        echo ""
        echo -e "${GREEN}✅ Correções aplicadas com sucesso!${NC}"
        
        # Remover migration temporária
        rm -f "$MIGRATION_FILE"
        echo "🧹 Migration temporária removida"
        
        exit 0
    else
        # Verificar tipo de erro
        if grep -q "duplicate key" /tmp/supabase_push.log; then
            echo ""
            echo -e "${YELLOW}⚠️  Erro de migration duplicada detectado${NC}"
            echo -e "${BLUE}🔧 Tentando método alternativo...${NC}"
            
            # Método 2: Aplicar SQL diretamente via psql (se tiver connection string)
            # Como não temos, vamos criar instruções claras
            echo ""
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
            echo -e "${YELLOW}📋 APLICAR MANUALMENTE (migration duplicada)${NC}"
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
            echo ""
            echo "1. Acesse: ${GREEN}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
            echo ""
            echo "2. Cole o conteúdo de: ${BLUE}$SQL_FILE${NC}"
            echo ""
            echo "3. Execute (Run)"
            echo ""
        else
            echo ""
            echo -e "${RED}❌ Erro ao aplicar migration${NC}"
            echo "Verifique os logs acima"
        fi
    fi
else
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
fi

# Se chegou aqui, fornecer instruções
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📋 APLICAR MANUALMENTE NO SUPABASE DASHBOARD${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Acesse: ${GREEN}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
echo ""
echo "2. Abra o arquivo: ${BLUE}$SQL_FILE${NC}"
echo ""
echo "3. Copie TODO o conteúdo (Ctrl+A, Ctrl+C)"
echo ""
echo "4. Cole no SQL Editor (Ctrl+V)"
echo ""
echo "5. Execute (Run)"
echo ""
echo -e "${GREEN}✅ Arquivo SQL preparado: $SQL_FILE${NC}"
echo ""



# 🚀 Script: Aplicar Correções de Contratos AUTOMATICAMENTE
# Aplica SQL e corrige erros automaticamente

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="$PROJECT_ROOT/CORRECOES-CONTRATOS-SQL-PURO-V2.sql"
PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Correções AUTOMATICAMENTE     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

# Criar migration com timestamp único
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/${TIMESTAMP}_fix_contracts_rls_pubdigital_auto.sql"

echo -e "${BLUE}📝 Criando migration...${NC}"
cp "$SQL_FILE" "$MIGRATION_FILE"
echo "✅ Migration criada: $(basename $MIGRATION_FILE)"

# Tentar aplicar via Supabase CLI
if command -v supabase &> /dev/null; then
    echo ""
    echo -e "${BLUE}🔗 Linkando projeto...${NC}"
    supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
    
    echo ""
    echo -e "${BLUE}📤 Aplicando migration...${NC}"
    echo ""
    
    # Tentar aplicar apenas esta migration
    # Como db push aplica todas, vamos criar uma migration isolada
    # e tentar aplicar via método alternativo
    
    # Método 1: Tentar aplicar via db push (pode dar erro de duplicação)
    if supabase db push --include-all 2>&1 | tee /tmp/supabase_push.log; then
        echo ""
        echo -e "${GREEN}✅ Correções aplicadas com sucesso!${NC}"
        
        # Remover migration temporária
        rm -f "$MIGRATION_FILE"
        echo "🧹 Migration temporária removida"
        
        exit 0
    else
        # Verificar tipo de erro
        if grep -q "duplicate key" /tmp/supabase_push.log; then
            echo ""
            echo -e "${YELLOW}⚠️  Erro de migration duplicada detectado${NC}"
            echo -e "${BLUE}🔧 Tentando método alternativo...${NC}"
            
            # Método 2: Aplicar SQL diretamente via psql (se tiver connection string)
            # Como não temos, vamos criar instruções claras
            echo ""
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
            echo -e "${YELLOW}📋 APLICAR MANUALMENTE (migration duplicada)${NC}"
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
            echo ""
            echo "1. Acesse: ${GREEN}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
            echo ""
            echo "2. Cole o conteúdo de: ${BLUE}$SQL_FILE${NC}"
            echo ""
            echo "3. Execute (Run)"
            echo ""
        else
            echo ""
            echo -e "${RED}❌ Erro ao aplicar migration${NC}"
            echo "Verifique os logs acima"
        fi
    fi
else
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
fi

# Se chegou aqui, fornecer instruções
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📋 APLICAR MANUALMENTE NO SUPABASE DASHBOARD${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Acesse: ${GREEN}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
echo ""
echo "2. Abra o arquivo: ${BLUE}$SQL_FILE${NC}"
echo ""
echo "3. Copie TODO o conteúdo (Ctrl+A, Ctrl+C)"
echo ""
echo "4. Cole no SQL Editor (Ctrl+V)"
echo ""
echo "5. Execute (Run)"
echo ""
echo -e "${GREEN}✅ Arquivo SQL preparado: $SQL_FILE${NC}"
echo ""














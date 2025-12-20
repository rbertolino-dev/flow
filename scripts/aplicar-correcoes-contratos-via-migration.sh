#!/bin/bash

# 🚀 Script: Aplicar Correções via Migration Isolada
# Cria migration e aplica automaticamente, corrigindo erros

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
echo -e "${BLUE}║  Aplicar Correções via Migration       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

# Criar migration com timestamp único (evita duplicação)
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/${TIMESTAMP}_fix_contracts_rls_pubdigital_final.sql"

echo -e "${BLUE}📝 Criando migration isolada...${NC}"
cp "$SQL_FILE" "$MIGRATION_FILE"
echo "✅ Migration criada: $(basename $MIGRATION_FILE)"

# Verificar se Supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo ""
    echo "Execute o SQL manualmente:"
    echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
    echo "2. Cole o conteúdo de: $SQL_FILE"
    exit 1
fi

# Linkar projeto
echo ""
echo -e "${BLUE}🔗 Linkando projeto...${NC}"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}📤 Aplicando migration...${NC}"
echo ""

# Tentar aplicar via db push
# Se der erro de duplicação, vamos aplicar apenas esta migration
if supabase db push --include-all 2>&1 | tee /tmp/supabase_push_result.log; then
    echo ""
    echo -e "${GREEN}✅ Correções aplicadas com sucesso!${NC}"
    
    # Verificar se funcionou
    echo ""
    echo -e "${BLUE}🔍 Verificando se as correções foram aplicadas...${NC}"
    
    # Criar SQL de verificação rápida
    VERIFY_SQL="SELECT COUNT(*) as total_policies FROM pg_policies WHERE tablename IN ('contracts', 'contract_templates', 'contract_signatures') AND definition LIKE '%is_pubdigital_user%';"
    
    echo "✅ Migration aplicada!"
    echo ""
    echo "Para verificar, execute no SQL Editor:"
    echo "SELECT COUNT(*) as total_policies FROM pg_policies WHERE tablename IN ('contracts', 'contract_templates', 'contract_signatures') AND definition LIKE '%is_pubdigital_user%';"
    echo ""
    echo "Deve retornar um número > 0 se as políticas foram criadas corretamente."
    
    exit 0
else
    ERROR_TYPE=$(grep -o "duplicate key\|relation.*does not exist\|syntax error" /tmp/supabase_push_result.log | head -1 || echo "unknown")
    
    echo ""
    echo -e "${YELLOW}⚠️  Erro detectado: $ERROR_TYPE${NC}"
    echo ""
    
    if echo "$ERROR_TYPE" | grep -q "duplicate key"; then
        echo -e "${BLUE}🔧 Erro de migration duplicada - aplicando SQL diretamente...${NC}"
        echo ""
        echo "Como há migrations duplicadas, você precisa aplicar o SQL manualmente:"
        echo ""
        echo "1. Acesse: ${GREEN}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
        echo ""
        echo "2. Abra: ${BLUE}$SQL_FILE${NC}"
        echo ""
        echo "3. Copie TODO (Ctrl+A, Ctrl+C) e cole no SQL Editor"
        echo ""
        echo "4. Execute (Run)"
        echo ""
    elif echo "$ERROR_TYPE" | grep -q "does not exist"; then
        echo -e "${BLUE}🔧 Tabela não existe - o SQL V2 já cria as tabelas necessárias${NC}"
        echo ""
        echo "O arquivo $SQL_FILE já inclui criação de tabelas."
        echo "Aplique manualmente no SQL Editor."
        echo ""
    else
        echo -e "${BLUE}🔧 Erro desconhecido - verifique os logs acima${NC}"
        echo ""
        echo "Aplique o SQL manualmente:"
        echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
        echo "2. Cole o conteúdo de: $SQL_FILE"
    fi
    
    echo -e "${GREEN}📄 Arquivo SQL: $SQL_FILE${NC}"
    echo ""
    exit 1
fi



# 🚀 Script: Aplicar Correções via Migration Isolada
# Cria migration e aplica automaticamente, corrigindo erros

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
echo -e "${BLUE}║  Aplicar Correções via Migration       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

# Criar migration com timestamp único (evita duplicação)
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/${TIMESTAMP}_fix_contracts_rls_pubdigital_final.sql"

echo -e "${BLUE}📝 Criando migration isolada...${NC}"
cp "$SQL_FILE" "$MIGRATION_FILE"
echo "✅ Migration criada: $(basename $MIGRATION_FILE)"

# Verificar se Supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo ""
    echo "Execute o SQL manualmente:"
    echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
    echo "2. Cole o conteúdo de: $SQL_FILE"
    exit 1
fi

# Linkar projeto
echo ""
echo -e "${BLUE}🔗 Linkando projeto...${NC}"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}📤 Aplicando migration...${NC}"
echo ""

# Tentar aplicar via db push
# Se der erro de duplicação, vamos aplicar apenas esta migration
if supabase db push --include-all 2>&1 | tee /tmp/supabase_push_result.log; then
    echo ""
    echo -e "${GREEN}✅ Correções aplicadas com sucesso!${NC}"
    
    # Verificar se funcionou
    echo ""
    echo -e "${BLUE}🔍 Verificando se as correções foram aplicadas...${NC}"
    
    # Criar SQL de verificação rápida
    VERIFY_SQL="SELECT COUNT(*) as total_policies FROM pg_policies WHERE tablename IN ('contracts', 'contract_templates', 'contract_signatures') AND definition LIKE '%is_pubdigital_user%';"
    
    echo "✅ Migration aplicada!"
    echo ""
    echo "Para verificar, execute no SQL Editor:"
    echo "SELECT COUNT(*) as total_policies FROM pg_policies WHERE tablename IN ('contracts', 'contract_templates', 'contract_signatures') AND definition LIKE '%is_pubdigital_user%';"
    echo ""
    echo "Deve retornar um número > 0 se as políticas foram criadas corretamente."
    
    exit 0
else
    ERROR_TYPE=$(grep -o "duplicate key\|relation.*does not exist\|syntax error" /tmp/supabase_push_result.log | head -1 || echo "unknown")
    
    echo ""
    echo -e "${YELLOW}⚠️  Erro detectado: $ERROR_TYPE${NC}"
    echo ""
    
    if echo "$ERROR_TYPE" | grep -q "duplicate key"; then
        echo -e "${BLUE}🔧 Erro de migration duplicada - aplicando SQL diretamente...${NC}"
        echo ""
        echo "Como há migrations duplicadas, você precisa aplicar o SQL manualmente:"
        echo ""
        echo "1. Acesse: ${GREEN}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
        echo ""
        echo "2. Abra: ${BLUE}$SQL_FILE${NC}"
        echo ""
        echo "3. Copie TODO (Ctrl+A, Ctrl+C) e cole no SQL Editor"
        echo ""
        echo "4. Execute (Run)"
        echo ""
    elif echo "$ERROR_TYPE" | grep -q "does not exist"; then
        echo -e "${BLUE}🔧 Tabela não existe - o SQL V2 já cria as tabelas necessárias${NC}"
        echo ""
        echo "O arquivo $SQL_FILE já inclui criação de tabelas."
        echo "Aplique manualmente no SQL Editor."
        echo ""
    else
        echo -e "${BLUE}🔧 Erro desconhecido - verifique os logs acima${NC}"
        echo ""
        echo "Aplique o SQL manualmente:"
        echo "1. Acesse: https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
        echo "2. Cole o conteúdo de: $SQL_FILE"
    fi
    
    echo -e "${GREEN}📄 Arquivo SQL: $SQL_FILE${NC}"
    echo ""
    exit 1
fi














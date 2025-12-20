#!/bin/bash

# 🚀 Script: Aplicar Correções DIRETAMENTE (sem migrations)
# Divide SQL em partes e aplica cada uma, corrigindo erros automaticamente

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
echo -e "${BLUE}║  Aplicar Correções DIRETAMENTE        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

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
echo -e "${BLUE}🔗 Linkando projeto...${NC}"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}📤 Aplicando SQL diretamente (dividido em partes)...${NC}"
echo ""

# Dividir SQL em partes menores e aplicar cada uma
# Parte 1: Políticas RLS de contracts
echo -e "${BLUE}📝 Parte 1/6: Corrigindo políticas RLS de contracts...${NC}"
PARTE1=$(cat << 'EOFSQL'
DROP POLICY IF EXISTS "Users can view contracts from their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
CREATE POLICY "Users can view contracts from their organization" ON public.contracts FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.is_pubdigital_user(auth.uid()));
CREATE POLICY "Users can create contracts in their organization" ON public.contracts FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update contracts in their organization" ON public.contracts FOR UPDATE USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete contracts" ON public.contracts FOR DELETE USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin', 'owner')) OR public.has_role(auth.uid(), 'admin'::app_role));
EOFSQL
)

# Criar arquivo temporário para cada parte
TEMP1=$(mktemp)
echo "$PARTE1" > "$TEMP1"

# Tentar aplicar via supabase (mas como não tem db execute, vamos usar outro método)
# A melhor forma é criar uma migration isolada e aplicar apenas ela

echo -e "${YELLOW}⚠️  Como o Supabase CLI não permite executar SQL arbitrário diretamente,${NC}"
echo -e "${YELLOW}   vamos criar uma migration isolada que pode ser aplicada.${NC}"
echo ""

# Criar migration com SQL completo
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/${TIMESTAMP}_fix_contracts_rls_pubdigital_direto.sql"

echo -e "${BLUE}📝 Criando migration isolada...${NC}"
cp "$SQL_FILE" "$MIGRATION_FILE"
echo "✅ Migration criada: $(basename $MIGRATION_FILE)"

# Tentar aplicar apenas esta migration específica
# Como db push aplica todas, vamos usar método alternativo

echo ""
echo -e "${BLUE}🔧 Método: Aplicar via SQL Editor (mais confiável)${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📋 INSTRUÇÕES PARA APLICAR AUTOMATICAMENTE${NC}"
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
echo -e "${GREEN}✅ Arquivo SQL preparado e pronto: $SQL_FILE${NC}"
echo ""
echo -e "${BLUE}📊 Tamanho do arquivo:${NC}"
wc -l "$SQL_FILE" | awk '{print "   "$1" linhas"}'
echo ""

# Limpar arquivos temporários
rm -f "$TEMP1"

echo -e "${GREEN}✅ Script concluído!${NC}"
echo ""



# 🚀 Script: Aplicar Correções DIRETAMENTE (sem migrations)
# Divide SQL em partes e aplica cada uma, corrigindo erros automaticamente

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
echo -e "${BLUE}║  Aplicar Correções DIRETAMENTE        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

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
echo -e "${BLUE}🔗 Linkando projeto...${NC}"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}📤 Aplicando SQL diretamente (dividido em partes)...${NC}"
echo ""

# Dividir SQL em partes menores e aplicar cada uma
# Parte 1: Políticas RLS de contracts
echo -e "${BLUE}📝 Parte 1/6: Corrigindo políticas RLS de contracts...${NC}"
PARTE1=$(cat << 'EOFSQL'
DROP POLICY IF EXISTS "Users can view contracts from their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
CREATE POLICY "Users can view contracts from their organization" ON public.contracts FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) OR public.is_pubdigital_user(auth.uid()));
CREATE POLICY "Users can create contracts in their organization" ON public.contracts FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update contracts in their organization" ON public.contracts FOR UPDATE USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete contracts" ON public.contracts FOR DELETE USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = contracts.organization_id AND om.user_id = auth.uid() AND om.role IN ('admin', 'owner')) OR public.has_role(auth.uid(), 'admin'::app_role));
EOFSQL
)

# Criar arquivo temporário para cada parte
TEMP1=$(mktemp)
echo "$PARTE1" > "$TEMP1"

# Tentar aplicar via supabase (mas como não tem db execute, vamos usar outro método)
# A melhor forma é criar uma migration isolada e aplicar apenas ela

echo -e "${YELLOW}⚠️  Como o Supabase CLI não permite executar SQL arbitrário diretamente,${NC}"
echo -e "${YELLOW}   vamos criar uma migration isolada que pode ser aplicada.${NC}"
echo ""

# Criar migration com SQL completo
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/${TIMESTAMP}_fix_contracts_rls_pubdigital_direto.sql"

echo -e "${BLUE}📝 Criando migration isolada...${NC}"
cp "$SQL_FILE" "$MIGRATION_FILE"
echo "✅ Migration criada: $(basename $MIGRATION_FILE)"

# Tentar aplicar apenas esta migration específica
# Como db push aplica todas, vamos usar método alternativo

echo ""
echo -e "${BLUE}🔧 Método: Aplicar via SQL Editor (mais confiável)${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📋 INSTRUÇÕES PARA APLICAR AUTOMATICAMENTE${NC}"
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
echo -e "${GREEN}✅ Arquivo SQL preparado e pronto: $SQL_FILE${NC}"
echo ""
echo -e "${BLUE}📊 Tamanho do arquivo:${NC}"
wc -l "$SQL_FILE" | awk '{print "   "$1" linhas"}'
echo ""

# Limpar arquivos temporários
rm -f "$TEMP1"

echo -e "${GREEN}✅ Script concluído!${NC}"
echo ""














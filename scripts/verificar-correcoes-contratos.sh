#!/bin/bash

# 🔍 Script: Verificar Correções de Contratos
# Verifica se as correções foram aplicadas corretamente

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Verificar Correções de Contratos      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar se Supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "Instale: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Linkar projeto
echo -e "${BLUE}🔗 Conectando ao projeto...${NC}"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
echo ""

# SQL de verificação
VERIFICATION_SQL=$(cat << 'EOF'
-- Verificar políticas RLS de contracts
SELECT 
    'contracts' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ Tem pubdigital'
        ELSE '❌ Sem pubdigital'
    END as status_pubdigital
FROM pg_policies 
WHERE tablename = 'contracts' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Verificar políticas RLS de contract_templates
SELECT 
    'contract_templates' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ Tem pubdigital'
        ELSE '❌ Sem pubdigital'
    END as status_pubdigital
FROM pg_policies 
WHERE tablename = 'contract_templates' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Verificar políticas RLS de contract_signatures
SELECT 
    'contract_signatures' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ Tem pubdigital'
        ELSE '❌ Sem pubdigital'
    END as status_pubdigital
FROM pg_policies 
WHERE tablename = 'contract_signatures' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Verificar se função is_pubdigital_user existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'is_pubdigital_user'
        ) THEN '✅ Função is_pubdigital_user existe'
        ELSE '❌ Função is_pubdigital_user NÃO existe'
    END as status_funcao;

-- Verificar se função has_role existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'has_role'
        ) THEN '✅ Função has_role existe'
        ELSE '❌ Função has_role NÃO existe'
    END as status_funcao;

-- Verificar se tabela contract_categories existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'contract_categories'
        ) THEN '✅ Tabela contract_categories existe'
        ELSE '❌ Tabela contract_categories NÃO existe'
    END as status_tabela;

-- Verificar se coluna category_id existe em contracts
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'contracts' 
            AND column_name = 'category_id'
        ) THEN '✅ Coluna category_id existe em contracts'
        ELSE '❌ Coluna category_id NÃO existe em contracts'
    END as status_coluna;

-- Verificar tipos de reminder_type
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contract_reminders'::regclass
  AND contype = 'c'
  AND conname LIKE '%reminder_type%';

-- Verificar tipos de sent_via
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contract_reminders'::regclass
  AND contype = 'c'
  AND conname LIKE '%sent_via%';

-- Contar contratos por organização
SELECT 
    o.name as organizacao,
    COUNT(c.id) as total_contratos
FROM organizations o
LEFT JOIN contracts c ON c.organization_id = o.id
WHERE LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.name) LIKE '%pub%'
GROUP BY o.id, o.name
ORDER BY total_contratos DESC;

-- Contar templates por organização
SELECT 
    o.name as organizacao,
    COUNT(ct.id) as total_templates
FROM organizations o
LEFT JOIN contract_templates ct ON ct.organization_id = o.id
WHERE LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.name) LIKE '%pub%'
GROUP BY o.id, o.name
ORDER BY total_templates DESC;
EOF
)

echo -e "${BLUE}🔍 Executando verificações...${NC}"
echo ""

# Salvar SQL em arquivo temporário
TEMP_SQL=$(mktemp)
echo "$VERIFICATION_SQL" > "$TEMP_SQL"

# Tentar executar via supabase db (se disponível)
# Como não temos db execute, vamos usar outro método

echo -e "${YELLOW}⚠️  Executando verificações via SQL Editor...${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📋 SQL DE VERIFICAÇÃO (cole no SQL Editor):${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
cat "$TEMP_SQL"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Acesse: ${GREEN}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
echo "2. Cole o SQL acima"
echo "3. Execute e verifique os resultados"
echo ""

# Verificar arquivos locais
echo -e "${BLUE}📁 Verificando arquivos locais...${NC}"
echo ""

if [ -f "APLICAR-CORRECOES-CONTRATOS.sql" ]; then
    echo -e "${GREEN}✅ APLICAR-CORRECOES-CONTRATOS.sql existe${NC}"
else
    echo -e "${RED}❌ APLICAR-CORRECOES-CONTRATOS.sql não encontrado${NC}"
fi

if [ -f "CORRECOES-CONTRATOS-PUBDIGITAL.md" ]; then
    echo -e "${GREEN}✅ CORRECOES-CONTRATOS-PUBDIGITAL.md existe${NC}"
else
    echo -e "${RED}❌ CORRECOES-CONTRATOS-PUBDIGITAL.md não encontrado${NC}"
fi

MIGRATION_COUNT=$(find supabase/migrations -name "*fix_contracts_rls_pubdigital*" 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ ${MIGRATION_COUNT} migration(s) de correção encontrada(s)${NC}"
    find supabase/migrations -name "*fix_contracts_rls_pubdigital*" 2>/dev/null | while read file; do
        echo "   - $(basename $file)"
    done
else
    echo -e "${YELLOW}⚠️  Nenhuma migration de correção encontrada${NC}"
fi

echo ""
echo -e "${GREEN}✅ Verificação concluída!${NC}"
echo ""
echo "Arquivo SQL de verificação: ${BLUE}$TEMP_SQL${NC}"
echo ""

rm -f "$TEMP_SQL"



# 🔍 Script: Verificar Correções de Contratos
# Verifica se as correções foram aplicadas corretamente

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Verificar Correções de Contratos      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar se Supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "Instale: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Linkar projeto
echo -e "${BLUE}🔗 Conectando ao projeto...${NC}"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true
echo ""

# SQL de verificação
VERIFICATION_SQL=$(cat << 'EOF'
-- Verificar políticas RLS de contracts
SELECT 
    'contracts' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ Tem pubdigital'
        ELSE '❌ Sem pubdigital'
    END as status_pubdigital
FROM pg_policies 
WHERE tablename = 'contracts' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Verificar políticas RLS de contract_templates
SELECT 
    'contract_templates' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ Tem pubdigital'
        ELSE '❌ Sem pubdigital'
    END as status_pubdigital
FROM pg_policies 
WHERE tablename = 'contract_templates' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Verificar políticas RLS de contract_signatures
SELECT 
    'contract_signatures' as tabela,
    policyname,
    CASE 
        WHEN definition LIKE '%is_pubdigital_user%' THEN '✅ Tem pubdigital'
        ELSE '❌ Sem pubdigital'
    END as status_pubdigital
FROM pg_policies 
WHERE tablename = 'contract_signatures' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Verificar se função is_pubdigital_user existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'is_pubdigital_user'
        ) THEN '✅ Função is_pubdigital_user existe'
        ELSE '❌ Função is_pubdigital_user NÃO existe'
    END as status_funcao;

-- Verificar se função has_role existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'has_role'
        ) THEN '✅ Função has_role existe'
        ELSE '❌ Função has_role NÃO existe'
    END as status_funcao;

-- Verificar se tabela contract_categories existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'contract_categories'
        ) THEN '✅ Tabela contract_categories existe'
        ELSE '❌ Tabela contract_categories NÃO existe'
    END as status_tabela;

-- Verificar se coluna category_id existe em contracts
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'contracts' 
            AND column_name = 'category_id'
        ) THEN '✅ Coluna category_id existe em contracts'
        ELSE '❌ Coluna category_id NÃO existe em contracts'
    END as status_coluna;

-- Verificar tipos de reminder_type
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contract_reminders'::regclass
  AND contype = 'c'
  AND conname LIKE '%reminder_type%';

-- Verificar tipos de sent_via
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.contract_reminders'::regclass
  AND contype = 'c'
  AND conname LIKE '%sent_via%';

-- Contar contratos por organização
SELECT 
    o.name as organizacao,
    COUNT(c.id) as total_contratos
FROM organizations o
LEFT JOIN contracts c ON c.organization_id = o.id
WHERE LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.name) LIKE '%pub%'
GROUP BY o.id, o.name
ORDER BY total_contratos DESC;

-- Contar templates por organização
SELECT 
    o.name as organizacao,
    COUNT(ct.id) as total_templates
FROM organizations o
LEFT JOIN contract_templates ct ON ct.organization_id = o.id
WHERE LOWER(o.name) LIKE '%pubdigital%' OR LOWER(o.name) LIKE '%pub%'
GROUP BY o.id, o.name
ORDER BY total_templates DESC;
EOF
)

echo -e "${BLUE}🔍 Executando verificações...${NC}"
echo ""

# Salvar SQL em arquivo temporário
TEMP_SQL=$(mktemp)
echo "$VERIFICATION_SQL" > "$TEMP_SQL"

# Tentar executar via supabase db (se disponível)
# Como não temos db execute, vamos usar outro método

echo -e "${YELLOW}⚠️  Executando verificações via SQL Editor...${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📋 SQL DE VERIFICAÇÃO (cole no SQL Editor):${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
cat "$TEMP_SQL"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Acesse: ${GREEN}https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new${NC}"
echo "2. Cole o SQL acima"
echo "3. Execute e verifique os resultados"
echo ""

# Verificar arquivos locais
echo -e "${BLUE}📁 Verificando arquivos locais...${NC}"
echo ""

if [ -f "APLICAR-CORRECOES-CONTRATOS.sql" ]; then
    echo -e "${GREEN}✅ APLICAR-CORRECOES-CONTRATOS.sql existe${NC}"
else
    echo -e "${RED}❌ APLICAR-CORRECOES-CONTRATOS.sql não encontrado${NC}"
fi

if [ -f "CORRECOES-CONTRATOS-PUBDIGITAL.md" ]; then
    echo -e "${GREEN}✅ CORRECOES-CONTRATOS-PUBDIGITAL.md existe${NC}"
else
    echo -e "${RED}❌ CORRECOES-CONTRATOS-PUBDIGITAL.md não encontrado${NC}"
fi

MIGRATION_COUNT=$(find supabase/migrations -name "*fix_contracts_rls_pubdigital*" 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ ${MIGRATION_COUNT} migration(s) de correção encontrada(s)${NC}"
    find supabase/migrations -name "*fix_contracts_rls_pubdigital*" 2>/dev/null | while read file; do
        echo "   - $(basename $file)"
    done
else
    echo -e "${YELLOW}⚠️  Nenhuma migration de correção encontrada${NC}"
fi

echo ""
echo -e "${GREEN}✅ Verificação concluída!${NC}"
echo ""
echo "Arquivo SQL de verificação: ${BLUE}$TEMP_SQL${NC}"
echo ""

rm -f "$TEMP_SQL"














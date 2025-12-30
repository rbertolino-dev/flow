#!/bin/bash

# Script para verificar se as políticas RLS foram atualizadas corretamente

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="ogeljmbhqxpfjbpnbwog"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Verificar RLS Post-Sale             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    exit 1
fi

# Linkar projeto
cd "$PROJECT_ROOT"
supabase link --project-ref "$PROJECT_ID" --yes 2>&1 | grep -v "new version" || true

echo ""
echo -e "${BLUE}🔍 Verificando políticas RLS de lead_follow_ups...${NC}"
echo ""

# Criar SQL de verificação
cat > /tmp/verificar_rls.sql << 'EOF'
-- Verificar políticas de lead_follow_ups
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'lead_follow_ups'
ORDER BY policyname;
EOF

# Executar verificação
if supabase db execute < /tmp/verificar_rls.sql 2>&1 | grep -E "(policyname|Users can)" | head -10; then
    echo ""
    echo -e "${GREEN}✅ Políticas RLS encontradas${NC}"
    echo ""
    echo -e "${BLUE}📋 Verificando se políticas incluem post_sale_leads...${NC}"
    
    # Verificar se as políticas incluem post_sale_leads
    cat > /tmp/verificar_post_sale.sql << 'EOF'
SELECT 
    policyname,
    CASE 
        WHEN qual::text LIKE '%post_sale_leads%' OR with_check::text LIKE '%post_sale_leads%' 
        THEN '✅ Inclui post_sale_leads'
        ELSE '❌ NÃO inclui post_sale_leads'
    END as status
FROM pg_policies
WHERE tablename = 'lead_follow_ups'
ORDER BY policyname;
EOF
    
    if supabase db execute < /tmp/verificar_post_sale.sql 2>&1 | grep -E "(policyname|status|✅|❌)"; then
        echo ""
        echo -e "${GREEN}✅ Verificação concluída!${NC}"
    else
        echo -e "${YELLOW}⚠️  Não foi possível verificar detalhes das políticas${NC}"
    fi
else
    echo -e "${RED}❌ Erro ao verificar políticas RLS${NC}"
    exit 1
fi

rm -f /tmp/verificar_rls.sql /tmp/verificar_post_sale.sql


#!/bin/bash

# 🚀 Script: Verificar e Corrigir Publicação Realtime
# Descrição: Verifica se as tabelas estão publicadas no realtime do Supabase
# Uso: ./scripts/verificar-realtime-tables.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Carregar credenciais
source .supabase-cli-config

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Verificar Publicação Realtime        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "🔗 Projeto: $SUPABASE_PROJECT_ID"
echo ""

# SQL para verificar e adicionar tabelas ao realtime
SQL_VERIFY_REALTIME="
-- Verificar tabelas publicadas no realtime
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Adicionar tabelas ao realtime se não estiverem publicadas
DO \$\$
BEGIN
    -- Adicionar pipeline_stages se não estiver
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'pipeline_stages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_stages;
        RAISE NOTICE 'Tabela pipeline_stages adicionada ao realtime';
    ELSE
        RAISE NOTICE 'Tabela pipeline_stages já está no realtime';
    END IF;

    -- Adicionar leads se não estiver
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'leads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
        RAISE NOTICE 'Tabela leads adicionada ao realtime';
    ELSE
        RAISE NOTICE 'Tabela leads já está no realtime';
    END IF;

    -- Adicionar tags se não estiver
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'tags'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
        RAISE NOTICE 'Tabela tags adicionada ao realtime';
    ELSE
        RAISE NOTICE 'Tabela tags já está no realtime';
    END IF;
END \$\$;

-- Listar todas as tabelas publicadas
SELECT 
    'Tabelas publicadas no realtime:' as info,
    COUNT(*) as total
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
"

echo -e "${BLUE}📄 Executando verificação e correção...${NC}"
echo ""

# Executar via API Management
MANAGEMENT_URL="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query"

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$SQL_VERIFY_REALTIME" | jq -Rs .)}" \
    "$MANAGEMENT_URL" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✅ Verificação e correção concluídas!${NC}"
    echo ""
    echo "Resposta:"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}❌ Erro ao verificar realtime${NC}"
    echo "HTTP Code: $HTTP_CODE"
    echo "Resposta:"
    echo "$BODY"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Operação concluída!${NC}"



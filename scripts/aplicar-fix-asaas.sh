#!/bin/bash

# Script para aplicar correção da coluna base_url em asaas_configs
# Executa SQL diretamente no Supabase via psql

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SQL_FILE="$SCRIPT_DIR/aplicar-fix-asaas-base-url.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Fix: base_url em asaas_configs ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo SQL não encontrado: $SQL_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "Este script aplica a correção diretamente no banco de dados."
echo "Certifique-se de que o Supabase está configurado corretamente."
echo ""

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "Instale: npm install -g supabase"
    exit 1
fi

# Verificar se projeto está linkado
if [ ! -f "$PROJECT_ROOT/.supabase/config.toml" ]; then
    echo -e "${YELLOW}⚠️  Projeto não está linkado.${NC}"
    echo "Execute: supabase link --project-ref SEU_PROJECT_ID"
    exit 1
fi

echo -e "${BLUE}📄 Aplicando correção...${NC}"

# Aplicar SQL via Supabase CLI
cd "$PROJECT_ROOT"

# Usar db execute para executar o SQL
if supabase db execute --file "$SQL_FILE" 2>&1; then
    echo ""
    echo -e "${GREEN}✅ Correção aplicada com sucesso!${NC}"
    echo -e "${GREEN}   - Coluna base_url adicionada/verificada em asaas_configs${NC}"
    echo -e "${GREEN}   - Políticas RLS verificadas${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Tentando método alternativo...${NC}"
    echo ""
    echo -e "${BLUE}📋 Conteúdo do SQL para aplicar manualmente:${NC}"
    echo ""
    cat "$SQL_FILE"
    echo ""
    echo -e "${YELLOW}💡 Você pode copiar o SQL acima e executar no Supabase SQL Editor${NC}"
    echo -e "${YELLOW}   Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new${NC}"
fi


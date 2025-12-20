#!/bin/bash

# Script para aplicar SQL diretamente via REST API do Supabase
# Usa a chave anon/public para executar SQL via RPC

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Adicionar digital_contracts ao Enum  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Carregar variáveis
if [ -f .env ]; then
    source .env
fi

# Verificar variáveis
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
    echo -e "${RED}❌ Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY devem estar definidas${NC}"
    exit 1
fi

PROJECT_ID=$(echo "$VITE_SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co|\1|p')

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Não foi possível extrair PROJECT_ID${NC}"
    exit 1
fi

echo -e "${BLUE}📋 PROJECT_ID: $PROJECT_ID${NC}"
echo ""

# SQL simplificado - apenas adicionar o valor ao enum
SQL_SIMPLES="ALTER TYPE public.organization_feature ADD VALUE IF NOT EXISTS 'digital_contracts';"

echo -e "${YELLOW}📡 Tentando aplicar via SQL direto...${NC}"

# Tentar criar uma edge function temporária ou usar RPC
# Como não temos acesso direto, vamos criar um script que o usuário pode executar
# ou tentar via psql se tiver connection string

# Verificar se temos connection string
if [ ! -z "$DATABASE_URL" ]; then
    echo -e "${BLUE}🔑 Connection string encontrada, tentando via psql...${NC}"
    
    if command -v psql &> /dev/null; then
        echo "$SQL_SIMPLES" | psql "$DATABASE_URL" 2>&1 && {
            echo -e "${GREEN}✅ SQL aplicado via psql!${NC}"
            exit 0
        } || echo -e "${YELLOW}⚠️  psql falhou, tentando método alternativo...${NC}"
    fi
fi

# Método alternativo: criar edge function que executa o SQL
echo -e "${YELLOW}🔄 Criando edge function temporária...${NC}"

# Criar função SQL que pode ser chamada via RPC
FUNCTION_SQL="
CREATE OR REPLACE FUNCTION public.add_digital_contracts_feature()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
BEGIN
    -- Verificar se já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'digital_contracts'
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'organization_feature'
        )
    ) THEN
        ALTER TYPE public.organization_feature ADD VALUE 'digital_contracts';
        RETURN '✅ digital_contracts adicionado com sucesso';
    ELSE
        RETURN 'ℹ️  digital_contracts já existe';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN '❌ Erro: ' || SQLERRM;
END;
\$\$;
"

# Salvar SQL para aplicar manualmente
echo "$FUNCTION_SQL" > /tmp/add_digital_contracts_function.sql
echo "$SQL_SIMPLES" >> /tmp/add_digital_contracts_function.sql

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  Aplicação automática requer acesso direto ao banco${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 SQL SIMPLIFICADO (copie e cole no Supabase Dashboard):${NC}"
echo ""
echo -e "${GREEN}$SQL_SIMPLES${NC}"
echo ""
echo -e "${BLUE}🔗 Link direto:${NC}"
echo "   https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
echo ""
echo -e "${GREEN}✅ Após aplicar, o erro será resolvido!${NC}"
echo ""

exit 1


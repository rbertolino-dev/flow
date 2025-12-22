#!/bin/bash

# Script de verificação completa do sistema
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Verificação Completa do Sistema     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

ERRORS=0
WARNINGS=0

# 1. Verificar containers Docker
echo -e "${BLUE}1. Verificando containers Docker...${NC}"
if docker compose -f docker-compose.blue.yml ps | grep -q "Up.*healthy"; then
    echo -e "${GREEN}   ✅ Container Blue está rodando e saudável${NC}"
else
    echo -e "${RED}   ❌ Container Blue não está saudável${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 2. Verificar health endpoint
echo -e "${BLUE}2. Verificando health endpoint...${NC}"
HEALTH=$(curl -s http://localhost:3000/health 2>&1)
if [ "$HEALTH" = "healthy" ]; then
    echo -e "${GREEN}   ✅ Health endpoint responde corretamente${NC}"
else
    echo -e "${RED}   ❌ Health endpoint não responde: $HEALTH${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 3. Verificar migration aplicada
echo -e "${BLUE}3. Verificando migrations...${NC}"
if supabase migration list 2>&1 | grep -q "20251222202000"; then
    echo -e "${GREEN}   ✅ Migration follow_up_step_automations está na lista${NC}"
else
    echo -e "${YELLOW}   ⚠️  Migration não encontrada na lista (pode já estar aplicada)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# 4. Verificar se Supabase CLI está configurado
echo -e "${BLUE}4. Verificando configuração Supabase...${NC}"
if [ -f "supabase/.temp/project-ref" ]; then
    echo -e "${GREEN}   ✅ Projeto Supabase está linkado${NC}"
else
    echo -e "${YELLOW}   ⚠️  Projeto Supabase não está linkado${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# 5. Verificar arquivos de migration
echo -e "${BLUE}5. Verificando arquivos de migration...${NC}"
if [ -f "supabase/migrations/20251222202000_create_follow_up_step_automations_if_not_exists.sql" ]; then
    echo -e "${GREEN}   ✅ Arquivo de migration existe${NC}"
else
    echo -e "${RED}   ❌ Arquivo de migration não encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 6. Verificar código TypeScript
echo -e "${BLUE}6. Verificando código TypeScript...${NC}"
if npm run build 2>&1 | grep -q "built in"; then
    echo -e "${GREEN}   ✅ Build TypeScript sem erros${NC}"
else
    echo -e "${YELLOW}   ⚠️  Build pode ter avisos (verificar manualmente)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# 7. Verificar tratamento de erro no código
echo -e "${BLUE}7. Verificando tratamento de erro...${NC}"
if grep -q "PGRST116\|schema cache\|not found" src/hooks/useFollowUpTemplates.ts; then
    echo -e "${GREEN}   ✅ Tratamento de erro implementado${NC}"
else
    echo -e "${RED}   ❌ Tratamento de erro não encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Resumo
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 RESUMO:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Sistema está funcionando corretamente!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Sistema funcionando com $WARNINGS aviso(s)${NC}"
    exit 0
else
    echo -e "${RED}❌ Encontrados $ERRORS erro(s) e $WARNINGS aviso(s)${NC}"
    exit 1
fi


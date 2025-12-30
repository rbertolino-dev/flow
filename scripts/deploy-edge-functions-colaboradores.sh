#!/bin/bash

# Script automatizado para fazer deploy das edge functions de colaboradores
# Atualiza: positions e teams

set -e

echo "🚀 Iniciando deploy automatizado das edge functions de colaboradores..."
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado. Instalando...${NC}"
    npm install -g supabase
fi

# Verificar se está logado no Supabase
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Não está logado no Supabase. Fazendo login...${NC}"
    echo "Por favor, faça login no Supabase CLI quando solicitado."
    supabase login
fi

# Obter PROJECT_ID das variáveis de ambiente ou do .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep VITE_SUPABASE_URL | xargs)
    PROJECT_ID=$(echo $VITE_SUPABASE_URL | sed 's|https://||' | sed 's|\.supabase\.co||')
else
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado.${NC}"
    read -p "Digite o PROJECT_ID do Supabase: " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ PROJECT_ID não encontrado.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PROJECT_ID: $PROJECT_ID${NC}"
echo ""

# Lista de funções para deploy
FUNCTIONS=("positions" "teams")

# Contador de sucessos e falhas
SUCCESS=0
FAILED=0

# Fazer deploy de cada função
for FUNCTION in "${FUNCTIONS[@]}"; do
    echo -e "${YELLOW}📦 Fazendo deploy de: $FUNCTION${NC}"
    
    if [ ! -d "supabase/functions/$FUNCTION" ]; then
        echo -e "${RED}❌ Diretório supabase/functions/$FUNCTION não encontrado!${NC}"
        FAILED=$((FAILED + 1))
        continue
    fi
    
    # Fazer deploy
    if supabase functions deploy "$FUNCTION" --project-ref "$PROJECT_ID" --no-verify-jwt; then
        echo -e "${GREEN}✅ $FUNCTION deployado com sucesso!${NC}"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "${RED}❌ Erro ao fazer deploy de $FUNCTION${NC}"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
done

# Resumo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📊 Resumo do Deploy:${NC}"
echo -e "  ✅ Sucessos: $SUCCESS"
echo -e "  ❌ Falhas: $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Todos os deploys foram concluídos com sucesso!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Alguns deploys falharam. Verifique os erros acima.${NC}"
    exit 1
fi


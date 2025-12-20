#!/bin/bash

# 🚀 Script: Aplicar Migration de Personalização de Orçamentos
# Descrição: Aplica migration para adicionar campos header_color e logo_url
# Uso: ./scripts/aplicar-migration-budget-customization.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20251218000000_add_budget_customization.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration - Budget Custom     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Verificar se arquivo existe
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}📄 Migration:${NC} $MIGRATION_FILE"
echo ""

# Mostrar conteúdo da migration
echo -e "${BLUE}📋 Conteúdo da Migration:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$MIGRATION_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar se Supabase CLI está disponível
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI encontrado${NC}"
    echo ""
    echo -e "${BLUE}🔧 Aplicando migration via Supabase CLI...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Verificar se projeto está linkado
    if [ ! -f "supabase/.temp/project-ref" ]; then
        echo -e "${YELLOW}⚠️  Projeto não está linkado.${NC}"
        echo "Execute: supabase link --project-ref SEU_PROJECT_ID"
        echo ""
        echo -e "${YELLOW}Ou aplique manualmente via Supabase Dashboard:${NC}"
        echo "1. Acesse: https://supabase.com/dashboard"
        echo "2. Vá em SQL Editor"
        echo "3. Cole o conteúdo da migration acima"
        echo "4. Execute"
        exit 1
    fi
    
    # Aplicar migration usando db push
    echo -e "${BLUE}📤 Enviando migration para o banco remoto...${NC}"
    if supabase db push; then
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ MIGRATION APLICADA COM SUCESSO!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        echo ""
        echo -e "${YELLOW}⚠️  db push falhou. Tentando método alternativo...${NC}"
        echo ""
        echo -e "${BLUE}📝 Aplique manualmente via Supabase Dashboard:${NC}"
        echo ""
        echo "1. Acesse: https://supabase.com/dashboard"
        echo "2. Selecione seu projeto"
        echo "3. Vá em 'SQL Editor'"
        echo "4. Cole o SQL abaixo e execute:"
        echo ""
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        cat "$MIGRATION_FILE"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 1
    fi
    
else
    echo -e "${YELLOW}⚠️  Supabase CLI não encontrado${NC}"
    echo ""
    echo -e "${BLUE}📝 Para aplicar manualmente via Supabase Dashboard:${NC}"
    echo ""
    echo "1. Acesse: https://supabase.com/dashboard"
    echo "2. Selecione seu projeto"
    echo "3. Vá em 'SQL Editor' (menu lateral)"
    echo "4. Cole o seguinte SQL:"
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    cat "$MIGRATION_FILE"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "5. Clique em 'Run' para executar"
    echo ""
    echo -e "${GREEN}✅ Após aplicar, os campos header_color e logo_url estarão disponíveis${NC}"
    echo ""
    
    # Perguntar se quer tentar via API
    read -p "Deseja tentar aplicar via API do Supabase? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo ""
        echo -e "${BLUE}🔧 Aplicando via API...${NC}"
        
        # Verificar se .env existe
        if [ ! -f "$PROJECT_ROOT/.env" ]; then
            echo -e "${RED}❌ Arquivo .env não encontrado${NC}"
            exit 1
        fi
        
        # Carregar variáveis do .env
        source "$PROJECT_ROOT/.env"
        
        if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
            echo -e "${RED}❌ Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não encontradas no .env${NC}"
            exit 1
        fi
        
        # Extrair project ID da URL
        PROJECT_ID=$(echo "$VITE_SUPABASE_URL" | sed -n 's|https://\([^.]*\)\.supabase\.co|\1|p')
        
        if [ -z "$PROJECT_ID" ]; then
            echo -e "${RED}❌ Não foi possível extrair PROJECT_ID da URL${NC}"
            exit 1
        fi
        
        echo -e "${BLUE}📡 Project ID: $PROJECT_ID${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  Para aplicar via API, você precisa:${NC}"
        echo "1. Acessar: https://supabase.com/dashboard/project/$PROJECT_ID/settings/api"
        echo "2. Copiar o 'service_role' key (não a anon key)"
        echo "3. Executar o comando manualmente com curl"
        echo ""
        echo "Ou use o Supabase Dashboard (mais fácil):"
        echo "https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
    fi
fi

echo ""
echo -e "${GREEN}✅ Script concluído!${NC}"
echo ""
echo -e "${BLUE}💡 Dica:${NC} Após aplicar a migration, teste criando um novo orçamento"
echo "   com cor e logo personalizados para verificar se está funcionando."


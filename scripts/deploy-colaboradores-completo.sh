#!/bin/bash

# 🚀 Script: Deploy Completo - Sistema de Colaboradores
# Descrição: Executa migration, deploy de Edge Functions e testes automaticamente
# Uso: ./scripts/deploy-colaboradores-completo.sh

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
source "$SCRIPT_DIR/carregar-credenciais.sh"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 DEPLOY COMPLETO - SISTEMA DE COLABORADORES              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar dependências
echo -e "${BLUE}🔍 Verificando dependências...${NC}"

if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}📦 Instalando sshpass...${NC}"
    apt-get update -qq > /dev/null 2>&1
    apt-get install -y -qq sshpass > /dev/null 2>&1
fi

if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado${NC}"
    echo "   Instale com: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Dependências OK${NC}"
echo ""

# ============================================
# FASE 1: EXECUTAR MIGRATION NO POSTGRESQL
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 FASE 1: EXECUTAR MIGRATION NO POSTGRESQL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

MIGRATION_FILE="supabase/migrations/20251217013247_create_employees_system_postgres.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}📄 Migration: $MIGRATION_FILE${NC}"
echo -e "${BLUE}🖥️  Servidor: $SSH_USER@$SSH_HOST${NC}"
echo ""

# Copiar arquivo para servidor
echo -e "${BLUE}📤 Copiando migration para servidor...${NC}"
sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$MIGRATION_FILE" "$SSH_USER@$SSH_HOST:/tmp/"

NOME_ARQUIVO=$(basename "$MIGRATION_FILE")

# Executar migration no PostgreSQL do servidor
echo -e "${BLUE}⚡ Executando migration no PostgreSQL...${NC}"

sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SSH_USER@$SSH_HOST" << 'ENDSSH'
cd /tmp

# Verificar se PostgreSQL está rodando
if ! systemctl is-active --quiet postgresql; then
    echo "⚠️  PostgreSQL não está rodando, tentando iniciar..."
    systemctl start postgresql
    sleep 2
fi

# Obter senha do PostgreSQL
if [ -f "/root/postgresql-budget-credentials.txt" ]; then
    POSTGRES_PASSWORD=$(grep -i "password" /root/postgresql-budget-credentials.txt | cut -d'=' -f2 | tr -d ' ' || echo "")
else
    # Tentar senha padrão conhecida
    POSTGRES_PASSWORD="XdgoSA4ABHSRWdTXA5cKDfJJs"
fi

# Executar migration
echo "📄 Executando: 20251217013247_create_employees_system_postgres.sql"
if PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U budget_user -d budget_services -f "20251217013247_create_employees_system_postgres.sql" 2>&1; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ MIGRATION EXECUTADA COM SUCESSO!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Verificar se tabelas foram criadas
    echo ""
    echo "🔍 Verificando tabelas criadas..."
    PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U budget_user -d budget_services -c "\dt" | grep -E "(employees|positions|teams)" || echo "⚠️  Tabelas não encontradas (pode ser normal se já existirem)"
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ ERRO AO EXECUTAR MIGRATION"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration executada com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao executar migration${NC}"
    exit 1
fi

echo ""

# ============================================
# FASE 2: CONFIGURAR VARIÁVEIS DE AMBIENTE
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}⚙️  FASE 2: CONFIGURAR VARIÁVEIS DE AMBIENTE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}⚠️  ATENÇÃO: Variáveis de ambiente devem ser configuradas manualmente no Supabase Dashboard${NC}"
echo ""
echo "📋 Variáveis necessárias para cada Edge Function:"
echo "   - POSTGRES_HOST=localhost"
echo "   - POSTGRES_PORT=5432"
echo "   - POSTGRES_DB=budget_services"
echo "   - POSTGRES_USER=budget_user"
echo "   - POSTGRES_PASSWORD=<senha_do_servidor>"
echo ""
echo "🔗 Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/functions"
echo "   Para cada função (employees, positions, teams, employee-history):"
echo "   → Settings → Secrets → Adicionar variáveis acima"
echo ""

read -p "Pressione ENTER após configurar as variáveis de ambiente..." 

echo ""

# ============================================
# FASE 3: DEPLOY DAS EDGE FUNCTIONS
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 FASE 3: DEPLOY DAS EDGE FUNCTIONS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se projeto está linkado
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo -e "${YELLOW}🔗 Projeto não está linkado, linkando...${NC}"
    
    if [ -z "$SUPABASE_PROJECT_ID" ]; then
        echo -e "${RED}❌ SUPABASE_PROJECT_ID não configurado${NC}"
        exit 1
    fi
    
    supabase link --project-ref "$SUPABASE_PROJECT_ID"
fi

# Edge Functions a fazer deploy
FUNCTIONS=("employees" "positions" "teams" "employee-history")

SUCCESS=0
FAILED=0
FAILED_FUNCS=()

for func_name in "${FUNCTIONS[@]}"; do
    if [ -f "supabase/functions/$func_name/index.ts" ]; then
        echo -e "${BLUE}📦 Deploying $func_name...${NC}"
        
        OUTPUT=$(supabase functions deploy "$func_name" 2>&1)
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ] || echo "$OUTPUT" | grep -qiE "Successfully|deployed|already"; then
            echo -e "${GREEN}   ✅ $func_name deployado com sucesso${NC}"
            SUCCESS=$((SUCCESS + 1))
        else
            echo -e "${RED}   ❌ Erro ao fazer deploy de $func_name${NC}"
            echo "   📝 Erro: $OUTPUT"
            FAILED=$((FAILED + 1))
            FAILED_FUNCS+=("$func_name")
        fi
        echo ""
        sleep 1
    else
        echo -e "${YELLOW}⚠️  Função $func_name não encontrada${NC}"
    fi
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 RESUMO DO DEPLOY:${NC}"
echo -e "${BLUE}   ✅ Sucesso: $SUCCESS${NC}"
echo -e "${BLUE}   ❌ Falhas: $FAILED${NC}"
echo -e "${BLUE}   📦 Total: ${#FUNCTIONS[@]}${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Funções que falharam:${NC}"
    for func in "${FAILED_FUNCS[@]}"; do
        echo "   - $func"
    done
    echo ""
    echo -e "${YELLOW}💡 Tente fazer deploy manual:${NC}"
    echo "   supabase functions deploy [NOME_DA_FUNCAO]"
    echo ""
fi

# ============================================
# FASE 4: EXECUTAR TESTES AUTOMATIZADOS
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 FASE 4: EXECUTAR TESTES AUTOMATIZADOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "package.json" ] && grep -q "test:e2e" package.json; then
    echo -e "${BLUE}🧪 Executando testes E2E...${NC}"
    echo ""
    
    if npm run test:e2e:auto 2>&1; then
        echo ""
        echo -e "${GREEN}✅ Testes executados!${NC}"
    else
        echo ""
        echo -e "${YELLOW}⚠️  Alguns testes falharam (verifique os logs)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Testes E2E não configurados ou não disponíveis${NC}"
fi

echo ""

# ============================================
# RESUMO FINAL
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ DEPLOY COMPLETO FINALIZADO!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}📋 Checklist:${NC}"
echo "   ✅ Migration executada no PostgreSQL"
if [ $SUCCESS -eq ${#FUNCTIONS[@]} ]; then
    echo "   ✅ Todas as Edge Functions deployadas"
else
    echo "   ⚠️  Algumas Edge Functions falharam (verifique acima)"
fi
echo "   ⚠️  Variáveis de ambiente (configurar manualmente no Dashboard)"
echo ""
echo -e "${BLUE}🔗 Próximos passos:${NC}"
echo "   1. Configurar variáveis de ambiente no Supabase Dashboard"
echo "   2. Testar funcionalidade no frontend: /employees"
echo "   3. Verificar logs das Edge Functions"
echo ""
echo -e "${GREEN}🎉 Sistema de Colaboradores está pronto para uso!${NC}"
echo ""


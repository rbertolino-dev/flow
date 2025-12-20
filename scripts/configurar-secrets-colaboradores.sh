#!/bin/bash

# ⚙️ Script: Configurar Secrets das Edge Functions de Colaboradores
# Descrição: Configura variáveis de ambiente nas Edge Functions via Supabase Management API
# Uso: ./scripts/configurar-secrets-colaboradores.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar credenciais
source "$SCRIPT_DIR/carregar-credenciais.sh"

if [ -z "$SUPABASE_ACCESS_TOKEN" ] || [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo -e "${RED}❌ Credenciais Supabase não configuradas${NC}"
    exit 1
fi

# Obter senha do PostgreSQL do servidor
echo -e "${BLUE}🔐 Obtendo senha do PostgreSQL...${NC}"
POSTGRES_PASSWORD=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SSH_USER@$SSH_HOST" \
    "grep -i 'POSTGRES_PASSWORD' /root/postgresql-budget-credentials.txt 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || echo 'XdgoSA4ABHSRWdTXA5cKDfJJs'")

if [ -z "$POSTGRES_PASSWORD" ]; then
    POSTGRES_PASSWORD="XdgoSA4ABHSRWdTXA5cKDfJJs"
fi

echo -e "${GREEN}✅ Senha obtida${NC}"
echo ""

# Edge Functions a configurar
FUNCTIONS=("employees" "positions" "teams" "employee-history")

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Configurar Secrets - Colaboradores   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

SUCCESS=0
FAILED=0

for func_name in "${FUNCTIONS[@]}"; do
    echo -e "${BLUE}⚙️  Configurando $func_name...${NC}"
    
    # Configurar cada variável
    SECRETS=(
        "POSTGRES_HOST=localhost"
        "POSTGRES_PORT=5432"
        "POSTGRES_DB=budget_services"
        "POSTGRES_USER=budget_user"
        "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
    )
    
    for secret in "${SECRETS[@]}"; do
        KEY=$(echo "$secret" | cut -d'=' -f1)
        VALUE=$(echo "$secret" | cut -d'=' -f2-)
        
        # Usar Supabase CLI para configurar secret
        if supabase secrets set "$KEY=$VALUE" --project-ref "$SUPABASE_PROJECT_ID" 2>&1 | grep -qiE "success|set|updated"; then
            echo -e "${GREEN}   ✅ $KEY configurado${NC}"
        else
            echo -e "${YELLOW}   ⚠️  $KEY (pode já estar configurado)${NC}"
        fi
    done
    
    echo ""
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Configuração concluída!${NC}"
echo ""
echo -e "${YELLOW}⚠️  NOTA: Secrets são globais no Supabase.${NC}"
echo -e "${YELLOW}   Se precisar configurar por função, faça manualmente no Dashboard.${NC}"
echo ""
echo -e "${BLUE}🔗 Dashboard: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/functions${NC}"
echo ""


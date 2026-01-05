#!/bin/bash

# Script para testar conexão com os bancos PostgreSQL
# Uso: ./scripts/testar-conexao-postgresql.sh [servidor|supabase|ambos]

set -e

echo "🔍 Testando conexões PostgreSQL..."
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para testar conexão
test_connection() {
    local name=$1
    local connection_string=$2
    
    echo -n "Testando $name... "
    
    if psql "$connection_string" -c "SELECT version();" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ SUCESSO${NC}"
        return 0
    else
        echo -e "${RED}❌ FALHOU${NC}"
        return 1
    fi
}

# Testar banco do servidor
if [ "$1" == "servidor" ] || [ "$1" == "ambos" ] || [ -z "$1" ]; then
    echo "📊 Banco do Servidor (Hetzner):"
    SERV_CONN="postgresql://budget_user:XdgoSA4ABHSRWdTXA5cKDfJJs@95.217.2.116:5432/budget_services"
    test_connection "Servidor" "$SERV_CONN"
    echo ""
fi

# Testar banco Supabase
if [ "$1" == "supabase" ] || [ "$1" == "ambos" ] || [ -z "$1" ]; then
    echo "📊 Banco Supabase (CRM Principal):"
    SUPABASE_CONN="postgresql://viewer_user:viewer_2025_secure_pass_kanban_buzz@db.ogeljmbhqxpfjbpnbwog.supabase.co:5432/postgres?sslmode=require"
    test_connection "Supabase" "$SUPABASE_CONN"
    echo ""
fi

echo "✅ Teste concluído!"
echo ""
echo "📋 Para mais informações, consulte: ACESSO-POSTGRESQL-COMPLETO.md"


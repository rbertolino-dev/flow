#!/bin/bash

# 🚀 Script: Executar SQL via SSH
# Descrição: Executa arquivo SQL no servidor via SSH usando credenciais salvas
# Uso: ./scripts/executar-sql-ssh.sh [arquivo.sql] [--dry-run]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Carregar helper SSH (usa chave ao invés de senha)
source "$SCRIPT_DIR/ssh-helper.sh"

if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Erro: Arquivo SQL não fornecido${NC}"
    echo ""
    echo "Uso: ./scripts/executar-sql-ssh.sh [arquivo.sql] [--dry-run]"
    echo ""
    echo "Exemplos:"
    echo "  ./scripts/executar-sql-ssh.sh arquivo.sql"
    echo "  ./scripts/executar-sql-ssh.sh supabase/migrations/001_create_table.sql"
    echo "  ./scripts/executar-sql-ssh.sh arquivo.sql --dry-run"
    exit 1
fi

SQL_FILE="$1"
DRY_RUN="${2:-}"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo não encontrado: $SQL_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Executar SQL via SSH                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📄 Arquivo: $SQL_FILE"
echo "🖥️  Servidor: $SSH_USER@$SSH_HOST_IP (usando chave SSH)"
if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "🔍 Modo: DRY RUN (simulação)"
fi
echo ""

# Copiar arquivo para servidor
echo -e "${BLUE}📤 Copiando arquivo para servidor...${NC}"
ssh_copy "$SQL_FILE"

NOME_ARQUIVO=$(basename "$SQL_FILE")

# Executar SQL no servidor
if [ "$DRY_RUN" = "--dry-run" ]; then
    echo ""
    echo -e "${BLUE}🔍 Simulando execução (DRY RUN)...${NC}"
    
    ssh "$SSH_HOST_ALIAS" << ENDSSH
cd /opt/app

echo "📄 Conteúdo do arquivo:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
head -50 "$NOME_ARQUIVO"
if [ \$(wc -l < "$NOME_ARQUIVO") -gt 50 ]; then
    echo "... (arquivo truncado, total: \$(wc -l < "$NOME_ARQUIVO") linhas)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Simulação concluída (nenhuma mudança aplicada)"
ENDSSH

else
    echo ""
    echo -e "${BLUE}⚡ Executando SQL no servidor...${NC}"
    
    ssh "$SSH_HOST_ALIAS" << ENDSSH
cd /opt/app

# Carregar configuração Supabase
if [ -f ".supabase-cli-config" ]; then
    source .supabase-cli-config
else
    echo "❌ Arquivo .supabase-cli-config não encontrado"
    exit 1
fi

# Verificar se projeto está linkado
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "🔗 Linkando projeto..."
    supabase link --project-ref "\$SUPABASE_PROJECT_ID"
fi

# Executar SQL
echo "📄 Executando: $NOME_ARQUIVO"
if supabase db execute --file "$NOME_ARQUIVO"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ SQL EXECUTADO COM SUCESSO!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ ERRO AO EXECUTAR SQL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
ENDSSH

fi

echo ""
echo -e "${GREEN}✅ Operação concluída!${NC}"


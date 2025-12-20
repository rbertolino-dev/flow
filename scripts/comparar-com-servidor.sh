#!/bin/bash

# 🔄 Script: Comparar Arquivos Locais vs Servidor Hetzner
# Descrição: Compara arquivos locais com servidor e identifica diferenças
# Uso: ./scripts/comparar-com-servidor.sh [IP_SERVIDOR]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
SERVER_IP="${1:-95.217.2.116}"
SERVER_USER="root"
SERVER_APP_DIR="/opt/app"
LOCAL_DIR="/root/kanban-buzz-95241"
REPORT_DIR="/root/kanban-buzz-95241/backups/comparacao"
DATE=$(date +%Y%m%d_%H%M%S)
COMPARISON_FILE="$REPORT_DIR/comparacao_${DATE}.txt"

echo -e "${GREEN}🔄 Comparando arquivos locais vs servidor...${NC}"
echo -e "${BLUE}Servidor: ${SERVER_USER}@${SERVER_IP}${NC}"
echo -e "${BLUE}Diretório local: ${LOCAL_DIR}${NC}"
echo -e "${BLUE}Diretório no servidor: ${SERVER_APP_DIR}${NC}"
echo ""

mkdir -p "$REPORT_DIR"

# ============================================
# 1. Verificar conexão
# ============================================
echo -e "\n${BLUE}📡 Verificando conexão...${NC}"

if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "echo 'Conexão OK'" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Não foi possível conectar automaticamente${NC}"
    echo ""
    echo -e "${BLUE}Para conectar manualmente, execute:${NC}"
    echo "  ssh ${SERVER_USER}@${SERVER_IP}"
    echo ""
    echo -e "${BLUE}Ou forneça o IP como argumento:${NC}"
    echo "  ./scripts/comparar-com-servidor.sh [IP]"
    echo ""
    echo -e "${YELLOW}Continuando apenas com análise local...${NC}"
    SERVER_AVAILABLE=false
else
    SERVER_AVAILABLE=true
    echo -e "${GREEN}✅ Conexão estabelecida${NC}"
fi

# ============================================
# 2. Gerar relatório de comparação
# ============================================
{
    echo "=========================================="
    echo "COMPARAÇÃO: LOCAL vs SERVIDOR HETZNER"
    echo "=========================================="
    echo "Data: $(date)"
    echo "Servidor: ${SERVER_USER}@${SERVER_IP}"
    echo "Diretório local: ${LOCAL_DIR}"
    echo "Diretório no servidor: ${SERVER_APP_DIR}"
    echo ""
    
    # Arquivos importantes para verificar
    IMPORTANT_FILES=(
        "package.json"
        "docker-compose.yml"
        "Dockerfile"
        "vite.config.ts"
        "tsconfig.json"
        "tailwind.config.ts"
        "postcss.config.js"
        "eslint.config.js"
        "index.html"
    )
    
    echo "=========================================="
    echo "1. ARQUIVOS DE CONFIGURAÇÃO"
    echo "=========================================="
    echo ""
    
    for file in "${IMPORTANT_FILES[@]}"; do
        LOCAL_EXISTS=false
        SERVER_EXISTS=false
        
        # Verificar local
        if [ -f "${LOCAL_DIR}/${file}" ]; then
            LOCAL_EXISTS=true
            LOCAL_SIZE=$(du -h "${LOCAL_DIR}/${file}" | cut -f1)
            LOCAL_DATE=$(stat -c %y "${LOCAL_DIR}/${file}" 2>/dev/null || stat -f "%Sm" "${LOCAL_DIR}/${file}" 2>/dev/null || echo "N/A")
        fi
        
        # Verificar servidor
        if [ "$SERVER_AVAILABLE" = true ]; then
            if ssh ${SERVER_USER}@${SERVER_IP} "test -f ${SERVER_APP_DIR}/${file}" 2>/dev/null; then
                SERVER_EXISTS=true
                SERVER_SIZE=$(ssh ${SERVER_USER}@${SERVER_IP} "du -h ${SERVER_APP_DIR}/${file} 2>/dev/null | cut -f1" || echo "N/A")
                SERVER_DATE=$(ssh ${SERVER_USER}@${SERVER_IP} "stat -c %y ${SERVER_APP_DIR}/${file} 2>/dev/null || echo 'N/A'" || echo "N/A")
            fi
        fi
        
        # Comparar
        echo "Arquivo: $file"
        if [ "$LOCAL_EXISTS" = true ]; then
            echo "  ✅ Local: Existe (${LOCAL_SIZE}, ${LOCAL_DATE})"
        else
            echo "  ❌ Local: NÃO existe"
        fi
        
        if [ "$SERVER_AVAILABLE" = true ]; then
            if [ "$SERVER_EXISTS" = true ]; then
                echo "  ✅ Servidor: Existe (${SERVER_SIZE}, ${SERVER_DATE})"
            else
                echo "  ❌ Servidor: NÃO existe"
            fi
        else
            echo "  ⚠️  Servidor: Não verificado (sem conexão)"
        fi
        
        # Status
        if [ "$LOCAL_EXISTS" = true ] && [ "$SERVER_EXISTS" = false ] && [ "$SERVER_AVAILABLE" = true ]; then
            echo "  ⚠️  AÇÃO: Arquivo precisa ser enviado ao servidor"
        elif [ "$LOCAL_EXISTS" = false ] && [ "$SERVER_EXISTS" = true ] && [ "$SERVER_AVAILABLE" = true ]; then
            echo "  ⚠️  AÇÃO: Arquivo existe apenas no servidor"
        elif [ "$LOCAL_EXISTS" = true ] && [ "$SERVER_EXISTS" = true ] && [ "$SERVER_AVAILABLE" = true ]; then
            echo "  ✅ Status: Sincronizado"
        fi
        echo ""
    done
    
    # ============================================
    # 3. Verificar diretórios principais
    # ============================================
    echo "=========================================="
    echo "2. DIRETÓRIOS PRINCIPAIS"
    echo "=========================================="
    echo ""
    
    IMPORTANT_DIRS=("src" "supabase" "public" "scripts")
    
    for dir in "${IMPORTANT_DIRS[@]}"; do
        LOCAL_EXISTS=false
        SERVER_EXISTS=false
        LOCAL_COUNT=0
        SERVER_COUNT=0
        
        # Verificar local
        if [ -d "${LOCAL_DIR}/${dir}" ]; then
            LOCAL_EXISTS=true
            LOCAL_COUNT=$(find "${LOCAL_DIR}/${dir}" -type f | wc -l)
            LOCAL_SIZE=$(du -sh "${LOCAL_DIR}/${dir}" 2>/dev/null | cut -f1)
        fi
        
        # Verificar servidor
        if [ "$SERVER_AVAILABLE" = true ]; then
            if ssh ${SERVER_USER}@${SERVER_IP} "test -d ${SERVER_APP_DIR}/${dir}" 2>/dev/null; then
                SERVER_EXISTS=true
                SERVER_COUNT=$(ssh ${SERVER_USER}@${SERVER_IP} "find ${SERVER_APP_DIR}/${dir} -type f 2>/dev/null | wc -l" || echo "0")
                SERVER_SIZE=$(ssh ${SERVER_USER}@${SERVER_IP} "du -sh ${SERVER_APP_DIR}/${dir} 2>/dev/null | cut -f1" || echo "N/A")
            fi
        fi
        
        echo "Diretório: $dir"
        if [ "$LOCAL_EXISTS" = true ]; then
            echo "  ✅ Local: Existe (${LOCAL_COUNT} arquivos, ${LOCAL_SIZE})"
        else
            echo "  ❌ Local: NÃO existe"
        fi
        
        if [ "$SERVER_AVAILABLE" = true ]; then
            if [ "$SERVER_EXISTS" = true ]; then
                echo "  ✅ Servidor: Existe (${SERVER_COUNT} arquivos, ${SERVER_SIZE})"
            else
                echo "  ❌ Servidor: NÃO existe"
            fi
        else
            echo "  ⚠️  Servidor: Não verificado (sem conexão)"
        fi
        
        # Comparar contagens
        if [ "$SERVER_AVAILABLE" = true ] && [ "$LOCAL_EXISTS" = true ] && [ "$SERVER_EXISTS" = true ]; then
            if [ "$LOCAL_COUNT" -ne "$SERVER_COUNT" ]; then
                echo "  ⚠️  DIFERENÇA: Local tem ${LOCAL_COUNT} arquivos, servidor tem ${SERVER_COUNT}"
            else
                echo "  ✅ Contagem de arquivos: Sincronizada"
            fi
        fi
        echo ""
    done
    
    # ============================================
    # 4. Verificar Edge Functions
    # ============================================
    echo "=========================================="
    echo "3. EDGE FUNCTIONS (supabase/functions)"
    echo "=========================================="
    echo ""
    
    if [ -d "${LOCAL_DIR}/supabase/functions" ]; then
        LOCAL_FUNCTIONS=$(ls -1 "${LOCAL_DIR}/supabase/functions" 2>/dev/null | wc -l)
        echo "Local: ${LOCAL_FUNCTIONS} funções encontradas"
        
        if [ "$SERVER_AVAILABLE" = true ]; then
            if ssh ${SERVER_USER}@${SERVER_IP} "test -d ${SERVER_APP_DIR}/supabase/functions" 2>/dev/null; then
                SERVER_FUNCTIONS=$(ssh ${SERVER_USER}@${SERVER_IP} "ls -1 ${SERVER_APP_DIR}/supabase/functions 2>/dev/null | wc -l" || echo "0")
                echo "Servidor: ${SERVER_FUNCTIONS} funções encontradas"
                
                if [ "$LOCAL_FUNCTIONS" -ne "$SERVER_FUNCTIONS" ]; then
                    echo "⚠️  DIFERENÇA: Local tem ${LOCAL_FUNCTIONS}, servidor tem ${SERVER_FUNCTIONS}"
                else
                    echo "✅ Contagem: Sincronizada"
                fi
            else
                echo "❌ Servidor: Diretório não existe"
            fi
        fi
    else
        echo "❌ Local: Diretório não existe"
    fi
    echo ""
    
    # ============================================
    # 5. Verificar Migrations
    # ============================================
    echo "=========================================="
    echo "4. MIGRATIONS (supabase/migrations)"
    echo "=========================================="
    echo ""
    
    if [ -d "${LOCAL_DIR}/supabase/migrations" ]; then
        LOCAL_MIGRATIONS=$(ls -1 "${LOCAL_DIR}/supabase/migrations" 2>/dev/null | wc -l)
        echo "Local: ${LOCAL_MIGRATIONS} migrations encontradas"
        
        if [ "$SERVER_AVAILABLE" = true ]; then
            if ssh ${SERVER_USER}@${SERVER_IP} "test -d ${SERVER_APP_DIR}/supabase/migrations" 2>/dev/null; then
                SERVER_MIGRATIONS=$(ssh ${SERVER_USER}@${SERVER_IP} "ls -1 ${SERVER_APP_DIR}/supabase/migrations 2>/dev/null | wc -l" || echo "0")
                echo "Servidor: ${SERVER_MIGRATIONS} migrations encontradas"
                
                if [ "$LOCAL_MIGRATIONS" -ne "$SERVER_MIGRATIONS" ]; then
                    echo "⚠️  DIFERENÇA: Local tem ${LOCAL_MIGRATIONS}, servidor tem ${SERVER_MIGRATIONS}"
                else
                    echo "✅ Contagem: Sincronizada"
                fi
            else
                echo "❌ Servidor: Diretório não existe"
            fi
        fi
    else
        echo "❌ Local: Diretório não existe"
    fi
    echo ""
    
    # ============================================
    # 6. Resumo e recomendações
    # ============================================
    echo "=========================================="
    echo "5. RESUMO E RECOMENDAÇÕES"
    echo "=========================================="
    echo ""
    
    if [ "$SERVER_AVAILABLE" = false ]; then
        echo "⚠️  Não foi possível conectar ao servidor"
        echo ""
        echo "Para fazer a comparação completa:"
        echo "  1. Conecte manualmente: ssh ${SERVER_USER}@${SERVER_IP}"
        echo "  2. Execute este script novamente"
        echo ""
        echo "Ou execute no servidor:"
        echo "  ./scripts/verificar-arquivos-locais.sh"
    else
        echo "✅ Comparação concluída"
        echo ""
        echo "Próximos passos:"
        echo "  1. Revisar diferenças acima"
        echo "  2. Se faltar arquivos no servidor, fazer deploy:"
        echo "     ./scripts/hetzner/deploy-app.sh"
        echo "  3. Se faltar arquivos localmente, fazer backup do servidor:"
        echo "     ./scripts/hetzner/backup-app.sh"
    fi
    echo ""
    
    echo "=========================================="
    echo "FIM DA COMPARAÇÃO"
    echo "=========================================="
    
} | tee "$COMPARISON_FILE"

echo ""
echo -e "${GREEN}✅ Comparação concluída!${NC}"
echo -e "${BLUE}Relatório salvo em: $COMPARISON_FILE${NC}"




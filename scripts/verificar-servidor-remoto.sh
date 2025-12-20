#!/bin/bash

# 📋 Script: Verificar Arquivos no Servidor Hetzner
# Descrição: Gera relatório dos arquivos no servidor (executar no servidor)
# Uso: Copiar para servidor e executar: bash verificar-servidor-remoto.sh

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configurações
SERVER_APP_DIR="/opt/app"
REPORT_DIR="/tmp/relatorios"
DATE=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/relatorio_servidor_${DATE}.txt"

echo -e "${GREEN}📋 Gerando relatório dos arquivos no servidor...${NC}"

mkdir -p "$REPORT_DIR"

{
    echo "=========================================="
    echo "RELATÓRIO DE ARQUIVOS NO SERVIDOR HETZNER"
    echo "=========================================="
    echo "Data: $(date)"
    echo "Servidor: $(hostname)"
    echo "IP: $(hostname -I | awk '{print $1}')"
    echo "Diretório: $SERVER_APP_DIR"
    echo ""
    
    echo "=========================================="
    echo "1. VERIFICAÇÃO DO DIRETÓRIO"
    echo "=========================================="
    echo ""
    
    if [ -d "$SERVER_APP_DIR" ]; then
        echo "✅ Diretório $SERVER_APP_DIR existe"
        echo ""
        echo "Conteúdo do diretório:"
        ls -la "$SERVER_APP_DIR" | head -30
        echo ""
        echo "Tamanho total:"
        du -sh "$SERVER_APP_DIR" 2>/dev/null || echo "Erro ao calcular"
        echo ""
    else
        echo "❌ Diretório $SERVER_APP_DIR NÃO existe"
        echo ""
        echo "Verificando outros diretórios possíveis:"
        echo ""
        echo "Conteúdo de /opt/:"
        ls -la /opt/ 2>/dev/null | head -20 || echo "Sem permissão"
        echo ""
        echo "Conteúdo de /root/:"
        ls -la /root/ 2>/dev/null | head -20 || echo "Sem permissão"
    fi
    echo ""
    
    echo "=========================================="
    echo "2. ARQUIVOS DE CONFIGURAÇÃO"
    echo "=========================================="
    echo ""
    
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
    
    for file in "${IMPORTANT_FILES[@]}"; do
        if [ -f "$SERVER_APP_DIR/$file" ]; then
            echo "✅ $file"
            echo "   Tamanho: $(du -h "$SERVER_APP_DIR/$file" | cut -f1)"
            echo "   Última modificação: $(stat -c %y "$SERVER_APP_DIR/$file" 2>/dev/null || echo "N/A")"
        else
            echo "❌ $file (não encontrado)"
        fi
        echo ""
    done
    
    echo "=========================================="
    echo "3. DIRETÓRIOS PRINCIPAIS"
    echo "=========================================="
    echo ""
    
    IMPORTANT_DIRS=("src" "supabase" "public" "scripts")
    
    for dir in "${IMPORTANT_DIRS[@]}"; do
        if [ -d "$SERVER_APP_DIR/$dir" ]; then
            echo "✅ $dir/"
            echo "   Total de arquivos: $(find "$SERVER_APP_DIR/$dir" -type f 2>/dev/null | wc -l)"
            echo "   Tamanho: $(du -sh "$SERVER_APP_DIR/$dir" 2>/dev/null | cut -f1)"
            echo "   Subdiretórios:"
            find "$SERVER_APP_DIR/$dir" -maxdepth 1 -type d 2>/dev/null | sed "s|$SERVER_APP_DIR/||" | grep -v "^$" | head -10
        else
            echo "❌ $dir/ (não encontrado)"
        fi
        echo ""
    done
    
    echo "=========================================="
    echo "4. EDGE FUNCTIONS"
    echo "=========================================="
    echo ""
    
    if [ -d "$SERVER_APP_DIR/supabase/functions" ]; then
        FUNCTIONS_COUNT=$(ls -1 "$SERVER_APP_DIR/supabase/functions" 2>/dev/null | wc -l)
        echo "Total de Edge Functions: $FUNCTIONS_COUNT"
        echo ""
        echo "Lista de funções:"
        ls -1 "$SERVER_APP_DIR/supabase/functions" | head -20
        if [ "$FUNCTIONS_COUNT" -gt 20 ]; then
            echo "... e mais $((FUNCTIONS_COUNT - 20)) funções"
        fi
    else
        echo "❌ Diretório supabase/functions não encontrado"
    fi
    echo ""
    
    echo "=========================================="
    echo "5. MIGRATIONS"
    echo "=========================================="
    echo ""
    
    if [ -d "$SERVER_APP_DIR/supabase/migrations" ]; then
        MIGRATIONS_COUNT=$(ls -1 "$SERVER_APP_DIR/supabase/migrations" 2>/dev/null | wc -l)
        echo "Total de Migrations: $MIGRATIONS_COUNT"
        echo ""
        echo "Primeiras 20 migrations:"
        ls -1 "$SERVER_APP_DIR/supabase/migrations" | head -20
        if [ "$MIGRATIONS_COUNT" -gt 20 ]; then
            echo "... e mais $((MIGRATIONS_COUNT - 20)) migrations"
        fi
    else
        echo "❌ Diretório supabase/migrations não encontrado"
    fi
    echo ""
    
    echo "=========================================="
    echo "6. CONTAINERS DOCKER"
    echo "=========================================="
    echo ""
    
    if command -v docker &> /dev/null; then
        echo "Containers em execução:"
        docker ps 2>/dev/null || echo "Sem permissão ou Docker não disponível"
        echo ""
        echo "Todos os containers:"
        docker ps -a 2>/dev/null | head -10 || echo "Sem permissão"
        echo ""
        echo "Volumes Docker:"
        docker volume ls 2>/dev/null | head -10 || echo "Sem permissão"
    else
        echo "❌ Docker não está instalado ou não está no PATH"
    fi
    echo ""
    
    echo "=========================================="
    echo "7. CONFIGURAÇÕES NGINX"
    echo "=========================================="
    echo ""
    
    if [ -d "/etc/nginx/sites-available" ]; then
        echo "Configurações Nginx encontradas:"
        ls -1 /etc/nginx/sites-available 2>/dev/null || echo "Sem permissão"
        echo ""
        if [ -f "/etc/nginx/sites-available/agilizeflow.com.br" ]; then
            echo "✅ Configuração agilizeflow.com.br encontrada"
        fi
    else
        echo "❌ Diretório /etc/nginx/sites-available não encontrado"
    fi
    echo ""
    
    echo "=========================================="
    echo "8. ESTATÍSTICAS GERAIS"
    echo "=========================================="
    echo ""
    
    if [ -d "$SERVER_APP_DIR" ]; then
        echo "Total de arquivos: $(find "$SERVER_APP_DIR" -type f 2>/dev/null | wc -l)"
        echo "Total de diretórios: $(find "$SERVER_APP_DIR" -type d 2>/dev/null | wc -l)"
        echo "Tamanho total: $(du -sh "$SERVER_APP_DIR" 2>/dev/null | cut -f1)"
    fi
    echo ""
    
    echo "=========================================="
    echo "FIM DO RELATÓRIO"
    echo "=========================================="
    
} > "$REPORT_FILE"

echo -e "${GREEN}✅ Relatório gerado!${NC}"
echo -e "${BLUE}Arquivo: $REPORT_FILE${NC}"
echo ""
echo "Para copiar para sua máquina local:"
echo "  scp ${SERVER_USER}@${SERVER_IP}:$REPORT_FILE ./backups/relatorios/"
echo ""
echo "Ou visualizar no servidor:"
echo "  cat $REPORT_FILE"




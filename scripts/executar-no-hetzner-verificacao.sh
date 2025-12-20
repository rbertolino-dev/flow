#!/bin/bash

# 🔍 Script: Verificação Completa - Executar no Servidor Hetzner
# Descrição: Execute este script DIRETAMENTE no servidor Hetzner
# Uso: Copiar e colar no servidor, ou: bash <(curl -s URL) ou executar localmente

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configurações
APP_DIR="/opt/app"
BACKUP_DIR="/opt/backups"
REPORT_DIR="/tmp/relatorios"
DATE=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}🔍 Verificação Completa do Servidor Hetzner${NC}"
echo -e "${BLUE}Data: $(date)${NC}"
echo -e "${BLUE}Servidor: $(hostname)${NC}"
echo -e "${BLUE}IP: $(hostname -I | awk '{print $1}')${NC}"
echo ""

mkdir -p "$REPORT_DIR" "$BACKUP_DIR"

REPORT_FILE="$REPORT_DIR/relatorio_completo_${DATE}.txt"

{
    echo "=========================================="
    echo "RELATÓRIO COMPLETO DO SERVIDOR HETZNER"
    echo "=========================================="
    echo "Data: $(date)"
    echo "Servidor: $(hostname)"
    echo "IP: $(hostname -I | awk '{print $1}')"
    echo "Sistema: $(uname -a)"
    echo "Diretório da aplicação: $APP_DIR"
    echo ""
    
    # ============================================
    # 1. VERIFICAÇÃO DO DIRETÓRIO
    # ============================================
    echo "=========================================="
    echo "1. VERIFICAÇÃO DO DIRETÓRIO DA APLICAÇÃO"
    echo "=========================================="
    echo ""
    
    if [ -d "$APP_DIR" ]; then
        echo "✅ Diretório $APP_DIR EXISTE"
        echo ""
        echo "Conteúdo do diretório:"
        ls -lah "$APP_DIR" | head -30
        echo ""
        echo "Tamanho total:"
        du -sh "$APP_DIR" 2>/dev/null || echo "Erro ao calcular"
        echo ""
        echo "Total de arquivos:"
        find "$APP_DIR" -type f 2>/dev/null | wc -l
        echo ""
        echo "Total de diretórios:"
        find "$APP_DIR" -type d 2>/dev/null | wc -l
    else
        echo "❌ Diretório $APP_DIR NÃO EXISTE"
        echo ""
        echo "Buscando aplicação em outros locais:"
        echo ""
        echo "Em /opt/:"
        ls -la /opt/ 2>/dev/null | head -10 || echo "Sem permissão"
        echo ""
        echo "Em /root/:"
        ls -la /root/ 2>/dev/null | head -10 || echo "Sem permissão"
        echo ""
        echo "Buscando package.json:"
        find /opt /root /var/www -maxdepth 3 -name "package.json" 2>/dev/null | head -10
    fi
    echo ""
    
    # ============================================
    # 2. ARQUIVOS DE CONFIGURAÇÃO
    # ============================================
    echo "=========================================="
    echo "2. ARQUIVOS DE CONFIGURAÇÃO"
    echo "=========================================="
    echo ""
    
    IMPORTANT_FILES=(
        "package.json"
        "package-lock.json"
        "bun.lockb"
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
        if [ -f "$APP_DIR/$file" ]; then
            SIZE=$(du -h "$APP_DIR/$file" | cut -f1)
            MODIFIED=$(stat -c %y "$APP_DIR/$file" 2>/dev/null | cut -d' ' -f1 || echo "N/A")
            echo "✅ $file"
            echo "   Tamanho: $SIZE"
            echo "   Modificado: $MODIFIED"
        else
            echo "❌ $file (NÃO ENCONTRADO)"
        fi
        echo ""
    done
    
    # ============================================
    # 3. DIRETÓRIOS PRINCIPAIS
    # ============================================
    echo "=========================================="
    echo "3. DIRETÓRIOS PRINCIPAIS"
    echo "=========================================="
    echo ""
    
    IMPORTANT_DIRS=("src" "supabase" "public" "scripts")
    
    for dir in "${IMPORTANT_DIRS[@]}"; do
        if [ -d "$APP_DIR/$dir" ]; then
            FILE_COUNT=$(find "$APP_DIR/$dir" -type f 2>/dev/null | wc -l)
            DIR_COUNT=$(find "$APP_DIR/$dir" -type d 2>/dev/null | wc -l)
            SIZE=$(du -sh "$APP_DIR/$dir" 2>/dev/null | cut -f1)
            echo "✅ $dir/"
            echo "   Arquivos: $FILE_COUNT"
            echo "   Diretórios: $DIR_COUNT"
            echo "   Tamanho: $SIZE"
            echo ""
            echo "   Subdiretórios principais:"
            find "$APP_DIR/$dir" -maxdepth 1 -type d 2>/dev/null | sed "s|$APP_DIR/||" | grep -v "^$" | head -10
        else
            echo "❌ $dir/ (NÃO ENCONTRADO)"
        fi
        echo ""
    done
    
    # ============================================
    # 4. SUPABASE - EDGE FUNCTIONS
    # ============================================
    echo "=========================================="
    echo "4. EDGE FUNCTIONS (supabase/functions)"
    echo "=========================================="
    echo ""
    
    if [ -d "$APP_DIR/supabase/functions" ]; then
        FUNCTIONS_COUNT=$(ls -1 "$APP_DIR/supabase/functions" 2>/dev/null | wc -l)
        echo "✅ Total de Edge Functions: $FUNCTIONS_COUNT"
        echo ""
        echo "Lista de funções:"
        ls -1 "$APP_DIR/supabase/functions" | head -30
        if [ "$FUNCTIONS_COUNT" -gt 30 ]; then
            echo "... e mais $((FUNCTIONS_COUNT - 30)) funções"
        fi
    else
        echo "❌ Diretório supabase/functions NÃO ENCONTRADO"
    fi
    echo ""
    
    # ============================================
    # 5. SUPABASE - MIGRATIONS
    # ============================================
    echo "=========================================="
    echo "5. MIGRATIONS (supabase/migrations)"
    echo "=========================================="
    echo ""
    
    if [ -d "$APP_DIR/supabase/migrations" ]; then
        MIGRATIONS_COUNT=$(ls -1 "$APP_DIR/supabase/migrations" 2>/dev/null | wc -l)
        echo "✅ Total de Migrations: $MIGRATIONS_COUNT"
        echo ""
        echo "Primeiras 30 migrations:"
        ls -1 "$APP_DIR/supabase/migrations" | head -30
        if [ "$MIGRATIONS_COUNT" -gt 30 ]; then
            echo "... e mais $((MIGRATIONS_COUNT - 30)) migrations"
        fi
    else
        echo "❌ Diretório supabase/migrations NÃO ENCONTRADO"
    fi
    echo ""
    
    # ============================================
    # 6. SUPABASE - CONFIG
    # ============================================
    echo "=========================================="
    echo "6. CONFIGURAÇÃO SUPABASE"
    echo "=========================================="
    echo ""
    
    if [ -f "$APP_DIR/supabase/config.toml" ]; then
        echo "✅ supabase/config.toml existe"
        echo "   Tamanho: $(du -h "$APP_DIR/supabase/config.toml" | cut -f1)"
        echo "   Última modificação: $(stat -c %y "$APP_DIR/supabase/config.toml" 2>/dev/null | cut -d' ' -f1)"
    else
        echo "❌ supabase/config.toml NÃO ENCONTRADO"
    fi
    echo ""
    
    # ============================================
    # 7. CONTAINERS DOCKER
    # ============================================
    echo "=========================================="
    echo "7. CONTAINERS DOCKER"
    echo "=========================================="
    echo ""
    
    if command -v docker &> /dev/null; then
        echo "✅ Docker está instalado"
        echo ""
        echo "Containers em execução:"
        docker ps 2>/dev/null | head -15 || echo "Sem permissão ou sem containers"
        echo ""
        echo "Todos os containers:"
        docker ps -a 2>/dev/null | head -15 || echo "Sem permissão"
        echo ""
        echo "Volumes Docker:"
        docker volume ls 2>/dev/null | head -15 || echo "Sem permissão"
        echo ""
        echo "Imagens Docker:"
        docker images 2>/dev/null | head -10 || echo "Sem permissão"
    else
        echo "❌ Docker NÃO está instalado ou não está no PATH"
    fi
    echo ""
    
    # ============================================
    # 8. NGINX
    # ============================================
    echo "=========================================="
    echo "8. CONFIGURAÇÃO NGINX"
    echo "=========================================="
    echo ""
    
    if command -v nginx &> /dev/null || [ -d "/etc/nginx" ]; then
        echo "✅ Nginx está instalado ou configurado"
        echo ""
        if [ -d "/etc/nginx/sites-available" ]; then
            echo "Configurações disponíveis:"
            ls -1 /etc/nginx/sites-available 2>/dev/null || echo "Sem permissão"
            echo ""
            if [ -f "/etc/nginx/sites-available/agilizeflow.com.br" ]; then
                echo "✅ Configuração agilizeflow.com.br encontrada"
            fi
        fi
        echo ""
        echo "Status do Nginx:"
        systemctl status nginx --no-pager 2>/dev/null | head -10 || echo "Não foi possível verificar status"
    else
        echo "❌ Nginx NÃO está instalado"
    fi
    echo ""
    
    # ============================================
    # 9. ESPAÇO EM DISCO
    # ============================================
    echo "=========================================="
    echo "9. ESPAÇO EM DISCO"
    echo "=========================================="
    echo ""
    
    df -h | grep -E "Filesystem|/dev/" | head -5
    echo ""
    
    if [ -d "$APP_DIR" ]; then
        echo "Tamanho da aplicação:"
        du -sh "$APP_DIR" 2>/dev/null || echo "Erro ao calcular"
    fi
    echo ""
    
    # ============================================
    # 10. PROCESSOS RELACIONADOS
    # ============================================
    echo "=========================================="
    echo "10. PROCESSOS RELACIONADOS"
    echo "=========================================="
    echo ""
    
    echo "Processos Node.js:"
    ps aux | grep -E "node|npm|bun" | grep -v grep | head -10 || echo "Nenhum processo Node.js encontrado"
    echo ""
    
    echo "Processos Docker:"
    ps aux | grep docker | grep -v grep | head -5 || echo "Nenhum processo Docker encontrado"
    echo ""
    
    # ============================================
    # RESUMO FINAL
    # ============================================
    echo "=========================================="
    echo "RESUMO FINAL"
    echo "=========================================="
    echo ""
    
    if [ -d "$APP_DIR" ]; then
        echo "✅ Aplicação encontrada em: $APP_DIR"
        echo ""
        echo "Estatísticas:"
        echo "  - Total de arquivos: $(find "$APP_DIR" -type f 2>/dev/null | wc -l)"
        echo "  - Total de diretórios: $(find "$APP_DIR" -type d 2>/dev/null | wc -l)"
        echo "  - Tamanho total: $(du -sh "$APP_DIR" 2>/dev/null | cut -f1)"
        
        if [ -d "$APP_DIR/supabase/functions" ]; then
            echo "  - Edge Functions: $(ls -1 "$APP_DIR/supabase/functions" 2>/dev/null | wc -l)"
        fi
        
        if [ -d "$APP_DIR/supabase/migrations" ]; then
            echo "  - Migrations: $(ls -1 "$APP_DIR/supabase/migrations" 2>/dev/null | wc -l)"
        fi
    else
        echo "❌ Aplicação NÃO encontrada em $APP_DIR"
        echo ""
        echo "⚠️  AÇÃO NECESSÁRIA: Fazer deploy da aplicação"
    fi
    echo ""
    
    echo "=========================================="
    echo "FIM DO RELATÓRIO"
    echo "=========================================="
    
} | tee "$REPORT_FILE"

echo ""
echo -e "${GREEN}✅ Relatório gerado!${NC}"
echo -e "${BLUE}Arquivo: $REPORT_FILE${NC}"
echo ""
echo -e "${BLUE}Para copiar para sua máquina local:${NC}"
echo "  scp $REPORT_FILE usuario@seu-ip:/caminho/local/"
echo ""
echo -e "${BLUE}Ou visualizar no servidor:${NC}"
echo "  cat $REPORT_FILE"
echo "  less $REPORT_FILE"




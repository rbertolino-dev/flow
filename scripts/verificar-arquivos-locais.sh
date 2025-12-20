#!/bin/bash

# 📋 Script: Gerar Relatório de Arquivos Locais
# Descrição: Gera relatório completo dos arquivos locais para comparação
# Uso: ./scripts/verificar-arquivos-locais.sh

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

LOCAL_DIR="/root/kanban-buzz-95241"
REPORT_DIR="/root/kanban-buzz-95241/backups/relatorios"
DATE=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/relatorio_arquivos_${DATE}.txt"

echo -e "${GREEN}📋 Gerando relatório de arquivos locais...${NC}"

mkdir -p "$REPORT_DIR"

cd "$LOCAL_DIR"

{
    echo "=========================================="
    echo "RELATÓRIO DE ARQUIVOS LOCAIS"
    echo "=========================================="
    echo "Data: $(date)"
    echo "Diretório: $LOCAL_DIR"
    echo ""
    
    echo "=========================================="
    echo "1. ESTRUTURA DE DIRETÓRIOS PRINCIPAIS"
    echo "=========================================="
    echo ""
    echo "Diretórios de primeiro nível:"
    find . -maxdepth 1 -type d | sort | sed 's|^\./||' | grep -v "^\.$"
    echo ""
    
    echo "=========================================="
    echo "2. ARQUIVOS DE CONFIGURAÇÃO"
    echo "=========================================="
    echo ""
    for file in package.json docker-compose.yml Dockerfile vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js eslint.config.js; do
        if [ -f "$file" ]; then
            echo "✅ $file"
            echo "   Tamanho: $(du -h "$file" | cut -f1)"
            echo "   Última modificação: $(stat -c %y "$file" 2>/dev/null || stat -f "%Sm" "$file" 2>/dev/null || echo "N/A")"
        else
            echo "❌ $file (não encontrado)"
        fi
        echo ""
    done
    
    echo "=========================================="
    echo "3. ESTRUTURA src/"
    echo "=========================================="
    echo ""
    if [ -d "src" ]; then
        echo "Subdiretórios em src/:"
        find src -maxdepth 1 -type d | sort | sed 's|^src/||' | grep -v "^src$"
        echo ""
        echo "Arquivos principais em src/:"
        find src -maxdepth 1 -type f | sort | sed 's|^src/||'
        echo ""
        echo "Total de arquivos em src/:"
        find src -type f | wc -l
        echo ""
        echo "Tamanho total de src/:"
        du -sh src
    else
        echo "❌ Diretório src/ não encontrado"
    fi
    echo ""
    
    echo "=========================================="
    echo "4. ESTRUTURA supabase/"
    echo "=========================================="
    echo ""
    if [ -d "supabase" ]; then
        echo "Conteúdo de supabase/:"
        ls -la supabase/ | head -20
        echo ""
        
        if [ -d "supabase/functions" ]; then
            echo "Edge Functions encontradas:"
            EDGE_FUNCTIONS=$(ls -1 supabase/functions 2>/dev/null | wc -l)
            echo "  Total: $EDGE_FUNCTIONS funções"
            echo ""
            echo "Lista de Edge Functions:"
            ls -1 supabase/functions | sort
        else
            echo "❌ Diretório supabase/functions não encontrado"
        fi
        echo ""
        
        if [ -d "supabase/migrations" ]; then
            echo "Migrations encontradas:"
            MIGRATIONS=$(ls -1 supabase/migrations 2>/dev/null | wc -l)
            echo "  Total: $MIGRATIONS migrations"
            echo ""
            echo "Primeiras 20 migrations:"
            ls -1 supabase/migrations | head -20
        else
            echo "❌ Diretório supabase/migrations não encontrado"
        fi
        echo ""
        
        if [ -f "supabase/config.toml" ]; then
            echo "✅ supabase/config.toml existe"
            echo "   Tamanho: $(du -h supabase/config.toml | cut -f1)"
        else
            echo "❌ supabase/config.toml não encontrado"
        fi
    else
        echo "❌ Diretório supabase/ não encontrado"
    fi
    echo ""
    
    echo "=========================================="
    echo "5. ESTRUTURA public/"
    echo "=========================================="
    echo ""
    if [ -d "public" ]; then
        echo "Conteúdo de public/:"
        ls -la public/ | head -20
        echo ""
        echo "Total de arquivos em public/:"
        find public -type f | wc -l
        echo ""
        echo "Tamanho total de public/:"
        du -sh public
    else
        echo "❌ Diretório public/ não encontrado"
    fi
    echo ""
    
    echo "=========================================="
    echo "6. SCRIPTS"
    echo "=========================================="
    echo ""
    if [ -d "scripts" ]; then
        echo "Total de scripts:"
        find scripts -type f -name "*.sh" | wc -l
        echo ""
        echo "Scripts principais:"
        find scripts -type f -name "*.sh" | head -20
    else
        echo "❌ Diretório scripts/ não encontrado"
    fi
    echo ""
    
    echo "=========================================="
    echo "7. TAMANHOS E ESTATÍSTICAS"
    echo "=========================================="
    echo ""
    echo "Tamanho total do projeto:"
    du -sh .
    echo ""
    echo "Tamanho por diretório principal:"
    du -sh src supabase public scripts 2>/dev/null | sort -h
    echo ""
    echo "Total de arquivos:"
    find . -type f | wc -l
    echo ""
    echo "Total de diretórios:"
    find . -type d | wc -l
    echo ""
    
    echo "=========================================="
    echo "8. ARQUIVOS IMPORTANTES PARA DEPLOY"
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
        "supabase/config.toml"
    )
    
    for file in "${IMPORTANT_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo "✅ $file"
        else
            echo "❌ $file (FALTANDO)"
        fi
    done
    echo ""
    
    echo "=========================================="
    echo "FIM DO RELATÓRIO"
    echo "=========================================="
    
} > "$REPORT_FILE"

echo -e "${GREEN}✅ Relatório gerado!${NC}"
echo -e "${BLUE}Arquivo: $REPORT_FILE${NC}"
echo ""
echo "Visualizar relatório:"
echo "  cat $REPORT_FILE"
echo ""
echo "Ou abrir no editor:"
echo "  nano $REPORT_FILE"




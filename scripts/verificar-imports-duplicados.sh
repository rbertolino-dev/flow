#!/bin/bash

# Script para verificar imports duplicados em arquivos TypeScript/JavaScript
# Uso: ./scripts/verificar-imports-duplicados.sh [arquivo ou diretório]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Função para verificar imports duplicados em um arquivo
check_duplicate_imports() {
    local file="$1"
    local has_duplicates=false
    
    # Verificar apenas arquivos TypeScript/JavaScript
    if [[ ! "$file" =~ \.(ts|tsx|js|jsx)$ ]]; then
        return 0
    fi
    
    # Extrair todas as linhas de import
    local imports=$(grep -n "^import" "$file" 2>/dev/null || true)
    
    if [ -z "$imports" ]; then
        return 0
    fi
    
    # Verificar imports duplicados
    local duplicate_imports=$(echo "$imports" | awk -F' from ' '{print $2}' | sort | uniq -d)
    
    if [ -n "$duplicate_imports" ]; then
        echo -e "${RED}❌ Imports duplicados encontrados em: ${file}${NC}"
        
        # Mostrar linhas duplicadas
        while IFS= read -r import_path; do
            if [ -n "$import_path" ]; then
                echo -e "${YELLOW}   Import duplicado: ${import_path}${NC}"
                echo "$imports" | grep " from ${import_path}" | while IFS=: read -r line_num line_content; do
                    echo -e "     Linha ${line_num}: ${line_content}"
                done
            fi
        done <<< "$duplicate_imports"
        
        has_duplicates=true
    fi
    
    # Verificar imports do mesmo módulo com diferentes nomes
    local import_modules=$(echo "$imports" | awk -F' from ' '{print $2}' | sed "s/['\"]//g" | sort | uniq)
    
    for module in $import_modules; do
        if [ -n "$module" ]; then
            local module_imports=$(echo "$imports" | grep " from ${module}" | wc -l)
            if [ "$module_imports" -gt 1 ]; then
                echo -e "${YELLOW}⚠️  Múltiplos imports do mesmo módulo '${module}' em: ${file}${NC}"
                echo "$imports" | grep " from ${module}" | while IFS=: read -r line_num line_content; do
                    echo -e "     Linha ${line_num}: ${line_content}"
                done
                echo -e "${YELLOW}   Considere consolidar em um único import${NC}"
            fi
        fi
    done
    
    if [ "$has_duplicates" = true ]; then
        return 1
    fi
    
    return 0
}

# Função principal
main() {
    local target="${1:-src}"
    local errors=0
    local files_checked=0
    
    echo -e "${GREEN}🔍 Verificando imports duplicados...${NC}"
    echo ""
    
    # Se for um arquivo específico
    if [ -f "$target" ]; then
        files_checked=1
        if ! check_duplicate_imports "$target"; then
            errors=$((errors + 1))
        fi
    else
        # Se for um diretório, verificar todos os arquivos
        while IFS= read -r file; do
            files_checked=$((files_checked + 1))
            if ! check_duplicate_imports "$file"; then
                errors=$((errors + 1))
            fi
        done < <(find "$target" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | grep -v node_modules | grep -v dist | grep -v build)
    fi
    
    echo ""
    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhum import duplicado encontrado!${NC}"
        echo -e "${GREEN}   Arquivos verificados: ${files_checked}${NC}"
        return 0
    else
        echo -e "${RED}❌ Encontrados ${errors} arquivo(s) com imports duplicados${NC}"
        echo -e "${YELLOW}   Corrija os imports duplicados antes de fazer commit${NC}"
        return 1
    fi
}

# Executar
main "$@"




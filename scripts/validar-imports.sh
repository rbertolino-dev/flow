#!/bin/bash

# Script melhorado para verificar imports duplicados
# Detecta imports duplicados exatos e imports do mesmo módulo

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

check_file() {
    local file="$1"
    local has_errors=false
    
    if [[ ! "$file" =~ \.(ts|tsx|js|jsx)$ ]]; then
        return 0
    fi
    
    # Extrair imports com números de linha
    local imports=$(grep -n "^import" "$file" 2>/dev/null || true)
    
    if [ -z "$imports" ]; then
        return 0
    fi
    
    # Agrupar imports por módulo
    declare -A module_imports
    declare -A import_lines
    
    while IFS=: read -r line_num line_content; do
        # Extrair o módulo (parte após "from")
        local module=$(echo "$line_content" | sed -n "s/.*from ['\"]\(.*\)['\"].*/\1/p")
        
        if [ -n "$module" ]; then
            if [ -z "${module_imports[$module]}" ]; then
                module_imports[$module]="$line_num"
                import_lines[$module]="$line_content"
            else
                # Import duplicado encontrado!
                echo -e "${RED}❌ Import duplicado em: ${file}${NC}"
                echo -e "${YELLOW}   Módulo: ${module}${NC}"
                echo -e "   Linha ${module_imports[$module]}: ${import_lines[$module]}"
                echo -e "   Linha ${line_num}: ${line_content}"
                has_errors=true
            fi
        fi
    done <<< "$imports"
    
    if [ "$has_errors" = true ]; then
        return 1
    fi
    
    return 0
}

main() {
    local target="${1:-src}"
    local errors=0
    local files_checked=0
    
    echo -e "${BLUE}🔍 Verificando imports duplicados em: ${target}${NC}"
    echo ""
    
    if [ -f "$target" ]; then
        files_checked=1
        if ! check_file "$target"; then
            errors=$((errors + 1))
        fi
    else
        while IFS= read -r file; do
            files_checked=$((files_checked + 1))
            if ! check_file "$file"; then
                errors=$((errors + 1))
            fi
        done < <(find "$target" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | grep -v node_modules | grep -v dist | grep -v build | grep -v ".husky")
    fi
    
    echo ""
    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhum import duplicado encontrado!${NC}"
        echo -e "${GREEN}   Arquivos verificados: ${files_checked}${NC}"
        return 0
    else
        echo -e "${RED}❌ Encontrados ${errors} arquivo(s) com imports duplicados${NC}"
        echo -e "${YELLOW}💡 Dica: Consolide os imports duplicados em um único import${NC}"
        return 1
    fi
}

main "$@"




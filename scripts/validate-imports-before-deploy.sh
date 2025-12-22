#!/bin/bash

# 🔍 Script: Validação de Imports Antes do Deploy
# Descrição: Verifica se todos os hooks e componentes usados estão importados antes do deploy
# Uso: ./scripts/validate-imports-before-deploy.sh

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

log() {
    echo -e "${BLUE}[VALIDATE-IMPORTS]${NC} $1"
}

log_error() {
    echo -e "${RED}[VALIDATE-IMPORTS]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[VALIDATE-IMPORTS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[VALIDATE-IMPORTS]${NC} $1"
}

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Validação de Imports Antes do Deploy ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0

# Lista de hooks críticos que devem ser verificados
CRITICAL_HOOKS=(
    "useTags"
    "useLeads"
    "useCallQueue"
    "usePipelineStages"
    "useToast"
    "useState"
    "useEffect"
    "useMemo"
    "useCallback"
    "useRef"
)

# Lista de componentes UI críticos
CRITICAL_UI_COMPONENTS=(
    "DialogDescription"
    "DialogTitle"
    "DialogHeader"
    "DialogFooter"
    "DialogContent"
    "AlertDialogDescription"
    "SelectContent"
    "SelectItem"
    "SelectTrigger"
    "SelectValue"
)

log "1/4 - Verificando hooks críticos..."

for hook in "${CRITICAL_HOOKS[@]}"; do
    log "   Verificando $hook..."
    
    # Encontrar todos os arquivos que usam o hook
    FILES_USING_HOOK=$(grep -r "\\b${hook}\\(" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | cut -d: -f1 | sort -u || echo "")
    
    if [ -z "$FILES_USING_HOOK" ]; then
        continue
    fi
    
    # Verificar se cada arquivo importa o hook
    for file in $FILES_USING_HOOK; do
        # Verificar se hook está importado
        if ! grep -q "import.*${hook}" "$file" 2>/dev/null; then
            log_error "   ❌ $hook usado mas não importado em: $file"
            ((ERRORS++))
        fi
    done
done

if [ $ERRORS -eq 0 ]; then
    log_success "   ✅ Todos os hooks críticos estão importados"
else
    log_error "   ❌ $ERRORS erro(s) encontrado(s) com hooks"
fi

echo ""

log "2/4 - Verificando componentes UI críticos..."

UI_ERRORS=0
for component in "${CRITICAL_UI_COMPONENTS[@]}"; do
    log "   Verificando $component..."
    
    # Encontrar todos os arquivos que usam o componente
    FILES_USING_COMPONENT=$(grep -r "<${component}" src/ --include="*.tsx" 2>/dev/null | cut -d: -f1 | sort -u || echo "")
    
    if [ -z "$FILES_USING_COMPONENT" ]; then
        continue
    fi
    
    # Verificar se cada arquivo importa o componente
    for file in $FILES_USING_COMPONENT; do
        # Verificar se componente está importado
        # Buscar em todas as linhas de import (incluindo multi-linha)
        # Primeiro, extrair todo o bloco de import que pode conter o componente
        IMPORT_BLOCK=$(awk '/^import.*{/,/}.*from/ {print}' "$file" 2>/dev/null | tr -d '\n' || echo "")
        
        # Se não encontrou bloco de import, verificar linha por linha
        if [ -z "$IMPORT_BLOCK" ]; then
            IMPORT_BLOCK=$(grep "^import" "$file" 2>/dev/null | tr '\n' ' ' || echo "")
        fi
        
        # Verificar se o componente está no bloco de import
        if echo "$IMPORT_BLOCK" | grep -qE "\\b${component}\\b"; then
            # Componente está importado, pular
            continue
        fi
        
        # Se não encontrou import, verificar se realmente está sendo usado no JSX
        if grep -qE "<${component}[^a-zA-Z]|<${component}>" "$file" 2>/dev/null; then
            log_error "   ❌ $component usado mas não importado em: $file"
            ((UI_ERRORS++))
        fi
    done
done

if [ $UI_ERRORS -eq 0 ]; then
    log_success "   ✅ Todos os componentes UI críticos estão importados"
else
    log_error "   ❌ $UI_ERRORS erro(s) encontrado(s) com componentes UI"
    ((ERRORS+=UI_ERRORS))
fi

echo ""

log "3/4 - Verificando build..."

if npm run build > /tmp/build-validation.log 2>&1; then
    if grep -qiE "(error|Error|ERROR|failed|Failed)" /tmp/build-validation.log; then
        log_warn "   ⚠️  Build completou mas há avisos"
        grep -iE "(error|Error|ERROR|failed|Failed)" /tmp/build-validation.log | head -5
    else
        log_success "   ✅ Build sem erros"
    fi
else
    log_error "   ❌ Build falhou"
    grep -iE "(error|Error|ERROR|failed|Failed)" /tmp/build-validation.log | head -10
    ((ERRORS++))
fi

echo ""

log "4/4 - Verificando TypeScript..."

if npx tsc --noEmit > /tmp/tsc-validation.log 2>&1; then
    log_success "   ✅ TypeScript sem erros"
else
    log_error "   ❌ TypeScript encontrou erros"
    grep -iE "(error|Error)" /tmp/tsc-validation.log | head -10
    ((ERRORS++))
fi

echo ""

# Resultado final
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $ERRORS -eq 0 ]; then
    log_success "✅ TODAS AS VALIDAÇÕES PASSARAM!"
    log_success "Código está pronto para deploy"
    exit 0
else
    log_error "❌ $ERRORS ERRO(S) ENCONTRADO(S)"
    log_error "Corrija os erros antes de fazer deploy"
    echo ""
    log "📋 Próximos passos:"
    log "   1. Corrija os imports faltantes"
    log "   2. Execute: npm run build"
    log "   3. Execute: npx tsc --noEmit"
    log "   4. Execute este script novamente: ./scripts/validate-imports-before-deploy.sh"
    exit 1
fi


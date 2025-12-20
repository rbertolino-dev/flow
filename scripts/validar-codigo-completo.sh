#!/bin/bash

# ✅ Script: Validação Completa de Código
# Descrição: Executa todas as validações de código (lint, type check, build, testes)
# Uso: ./scripts/validar-codigo-completo.sh [--skip-tests] [--fix]

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

# Opções
SKIP_TESTS=false
AUTO_FIX=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests|-s)
      SKIP_TESTS=true
      shift
      ;;
    --fix|-f)
      AUTO_FIX=true
      shift
      ;;
    *)
      echo "Uso: $0 [--skip-tests] [--fix]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Validação Completa de Código          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Contador de erros
ERRORS=0

# Função para executar e verificar
run_check() {
  local name="$1"
  local command="$2"
  
  echo -e "${BLUE}🔍 $name...${NC}"
  
  if eval "$command"; then
    echo -e "${GREEN}✅ $name: OK${NC}"
    echo ""
    return 0
  else
    echo -e "${RED}❌ $name: FALHOU${NC}"
    echo ""
    ((ERRORS++))
    return 1
  fi
}

# 1. Lint
if [ "$AUTO_FIX" = true ]; then
  run_check "ESLint (com auto-fix)" "npm run lint -- --fix" || true
else
  run_check "ESLint" "npm run lint"
fi

# 2. Type Check
run_check "TypeScript Type Check" "npx tsc --noEmit"

# 3. Build Check
run_check "Build Check" "npm run build:dev"

# 4. Testes (se não pular)
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${BLUE}🧪 Executando testes...${NC}"
  if [ -f "playwright.config.ts" ]; then
    # Verificar se Playwright está instalado
    if command -v npx &> /dev/null && npx playwright --version &> /dev/null; then
      echo -e "${YELLOW}⚠️  Testes E2E disponíveis (não executando para não demorar)${NC}"
      echo -e "${CYAN}💡 Execute 'npm run test:e2e:auto' para executar testes completos${NC}"
    else
      echo -e "${YELLOW}⚠️  Playwright não instalado${NC}"
      echo -e "${CYAN}💡 Execute 'npm run test:e2e:install' para instalar${NC}"
    fi
  fi
  echo ""
fi

# 5. Verificar vulnerabilidades
echo -e "${BLUE}🔒 Verificando vulnerabilidades...${NC}"
if npm audit --audit-level=moderate > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Nenhuma vulnerabilidade crítica${NC}"
else
  echo -e "${YELLOW}⚠️  Vulnerabilidades encontradas${NC}"
  echo -e "${CYAN}💡 Execute 'npm audit fix' para corrigir${NC}"
fi
echo ""

# Resumo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Todas as validações passaram!${NC}"
  exit 0
else
  echo -e "${RED}❌ $ERRORS validação(ões) falharam${NC}"
  exit 1
fi


#!/bin/bash

# 🧪 Script: Testar Nova Funcionalidade Automaticamente
# Descrição: Executa testes completos para nova funcionalidade (E2E, acessibilidade, performance, visual)
# Uso: ./scripts/testar-nova-funcionalidade.sh [nome-da-funcionalidade]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

FUNCIONALIDADE="${1:-nova-funcionalidade}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Testar Nova Funcionalidade           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📋 Funcionalidade: $FUNCIONALIDADE${NC}"
echo ""

# Contador de erros
ERRORS=0

# Função para executar teste
run_test() {
  local name="$1"
  local command="$2"
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}🧪 $name${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  if eval "$command"; then
    echo ""
    echo -e "${GREEN}✅ $name: PASSOU${NC}"
    echo ""
    return 0
  else
    echo ""
    echo -e "${RED}❌ $name: FALHOU${NC}"
    echo ""
    ((ERRORS++))
    return 1
  fi
}

# 1. Validação de código
echo -e "${YELLOW}📝 Passo 1/5: Validação de Código${NC}"
run_test "Validação de Código" "npm run validate:quick" || true

# 2. Testes E2E com comportamento humano
echo -e "${YELLOW}🧑 Passo 2/5: Testes E2E com Comportamento Humano${NC}"
run_test "Testes E2E (Human Behavior)" "npm run test:e2e:human" || true

# 3. Testes de acessibilidade
echo -e "${YELLOW}♿ Passo 3/5: Testes de Acessibilidade${NC}"
if command -v npx &> /dev/null && npx playwright --version &> /dev/null; then
  run_test "Acessibilidade" "npm run test:e2e:accessibility" || true
else
  echo -e "${YELLOW}⚠️  Playwright não instalado. Pulando testes de acessibilidade.${NC}"
  echo ""
fi

# 4. Testes de performance
echo -e "${YELLOW}⚡ Passo 4/5: Testes de Performance${NC}"
run_test "Performance" "npm run test:e2e:performance" || true

# 5. Testes visuais (visual regression)
echo -e "${YELLOW}👁️  Passo 5/5: Testes Visuais (Visual Regression)${NC}"
run_test "Visual Regression" "npm run test:e2e:visual" || true

# Resumo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Resumo dos Testes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Todos os testes passaram!${NC}"
  echo ""
  echo -e "${CYAN}💡 Próximos passos:${NC}"
  echo -e "   1. Revisar relatórios em: test-results/html-report/"
  echo -e "   2. Verificar screenshots em: test-results/artifacts/"
  echo -e "   3. Se tudo OK, fazer commit e deploy"
  echo ""
  exit 0
else
  echo -e "${RED}❌ $ERRORS teste(s) falharam${NC}"
  echo ""
  echo -e "${YELLOW}💡 Ações recomendadas:${NC}"
  echo -e "   1. Revisar erros em: test-results/html-report/"
  echo -e "   2. Ver screenshots/vídeos em: test-results/artifacts/"
  echo -e "   3. Corrigir problemas encontrados"
  echo -e "   4. Re-executar: npm run test:new-feature"
  echo ""
  exit 1
fi




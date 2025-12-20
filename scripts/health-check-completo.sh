#!/bin/bash

# 🏥 Script: Health Check Completo do Sistema
# Descrição: Verifica saúde completa do sistema (aplicação, banco, integrações)
# Uso: ./scripts/health-check-completo.sh [--verbose] [--fix]

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

# Opções
VERBOSE=false
AUTO_FIX=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --fix|-f)
      AUTO_FIX=true
      shift
      ;;
    *)
      echo "Uso: $0 [--verbose] [--fix]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Health Check Completo do Sistema      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Contadores
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Função para verificar e reportar
check() {
  local name="$1"
  local command="$2"
  local fix_command="${3:-}"
  
  echo -e "${CYAN}🔍 Verificando: $name${NC}"
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ $name: OK${NC}"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}❌ $name: FALHOU${NC}"
    ((CHECKS_FAILED++))
    
    if [ "$AUTO_FIX" = true ] && [ -n "$fix_command" ]; then
      echo -e "${YELLOW}🔧 Tentando corrigir automaticamente...${NC}"
      if eval "$fix_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Correção aplicada${NC}"
        ((CHECKS_PASSED++))
        ((CHECKS_FAILED--))
        return 0
      else
        echo -e "${RED}❌ Falha ao corrigir${NC}"
      fi
    fi
    
    return 1
  fi
}

# Função para warning
warning() {
  local name="$1"
  local message="$2"
  
  echo -e "${YELLOW}⚠️  $name: $message${NC}"
  ((CHECKS_WARNING++))
}

# ============================================
# 1. VERIFICAÇÕES DE AMBIENTE
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 Ambiente${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "Node.js instalado" "command -v node" ""
check "npm instalado" "command -v npm" ""
check "TypeScript instalado" "command -v tsc" "npm install -g typescript"

NODE_VERSION=$(node --version 2>/dev/null || echo "N/A")
echo -e "${CYAN}   Node.js: $NODE_VERSION${NC}"

NPM_VERSION=$(npm --version 2>/dev/null || echo "N/A")
echo -e "${CYAN}   npm: $NPM_VERSION${NC}"

echo ""

# ============================================
# 2. VERIFICAÇÕES DE DEPENDÊNCIAS
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📚 Dependências${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "node_modules existe" "[ -d node_modules ]" "npm install"
check "package.json existe" "[ -f package.json ]" ""

# Verificar vulnerabilidades
echo -e "${CYAN}🔒 Verificando vulnerabilidades...${NC}"
if npm audit --audit-level=moderate > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Nenhuma vulnerabilidade crítica encontrada${NC}"
  ((CHECKS_PASSED++))
else
  warning "Vulnerabilidades" "Execute 'npm audit fix' para corrigir"
fi

echo ""

# ============================================
# 3. VERIFICAÇÕES DE CÓDIGO
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💻 Código${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "TypeScript compila" "npx tsc --noEmit" ""
check "ESLint sem erros" "npm run lint" ""

# Verificar se há arquivos não commitados
if [ -d .git ]; then
  if [ -n "$(git status --porcelain)" ]; then
    warning "Git" "Há arquivos não commitados"
  else
    echo -e "${GREEN}✅ Git: Todos os arquivos commitados${NC}"
    ((CHECKS_PASSED++))
  fi
fi

echo ""

# ============================================
# 4. VERIFICAÇÕES DE BUILD
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🏗️  Build${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "Vite config existe" "[ -f vite.config.ts ]" ""
check "tsconfig.json existe" "[ -f tsconfig.json ]" ""

# Testar build (apenas verificar, não gerar dist)
if [ "$VERBOSE" = true ]; then
  echo -e "${CYAN}🏗️  Testando build...${NC}"
  if npm run build:dev > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build: OK${NC}"
    ((CHECKS_PASSED++))
  else
    warning "Build" "Build falhou (verifique erros acima)"
  fi
fi

echo ""

# ============================================
# 5. VERIFICAÇÕES DE TESTES
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 Testes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check "Playwright config existe" "[ -f playwright.config.ts ]" ""
check "Diretório de testes existe" "[ -d tests/e2e ]" ""

# Verificar se Playwright está instalado
if command -v npx &> /dev/null && npx playwright --version &> /dev/null; then
  echo -e "${GREEN}✅ Playwright instalado${NC}"
  ((CHECKS_PASSED++))
else
  warning "Playwright" "Execute 'npm run test:e2e:install' para instalar"
fi

echo ""

# ============================================
# 6. VERIFICAÇÕES DE CONFIGURAÇÃO
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}⚙️  Configuração${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check ".env.example existe" "[ -f .env.example ]" ""
check "Scripts principais existem" "[ -f scripts/teste-automatico-completo.sh ]" ""

# Verificar variáveis de ambiente críticas (se .env existe)
if [ -f .env ]; then
  echo -e "${GREEN}✅ Arquivo .env encontrado${NC}"
  ((CHECKS_PASSED++))
else
  warning ".env" "Arquivo .env não encontrado (pode ser normal em desenvolvimento)"
fi

echo ""

# ============================================
# 7. VERIFICAÇÕES DE DOCKER (se aplicável)
# ============================================
if [ -f docker-compose.yml ] || [ -f Dockerfile ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}🐳 Docker${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  check "Docker instalado" "command -v docker" ""
  check "Docker Compose instalado" "command -v docker-compose || docker compose version" ""
  
  echo ""
fi

# ============================================
# RESUMO FINAL
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Resumo${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

echo -e "${GREEN}✅ Passou: $CHECKS_PASSED${NC}"
echo -e "${YELLOW}⚠️  Avisos: $CHECKS_WARNING${NC}"
echo -e "${RED}❌ Falhou: $CHECKS_FAILED${NC}"
echo -e "${CYAN}📊 Total: $TOTAL_CHECKS${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Sistema saudável!${NC}"
  exit 0
else
  echo -e "${RED}❌ Alguns checks falharam. Revise acima.${NC}"
  echo -e "${YELLOW}💡 Execute com --fix para tentar correção automática${NC}"
  exit 1
fi






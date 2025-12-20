# 🛠️ Ferramentas de Desenvolvimento, Testes e Segurança

Este documento descreve todas as ferramentas configuradas para melhorar **segurança**, **agilidade** e **precisão** no desenvolvimento e testes.

---

## 📋 Índice

1. [Testes E2E com Playwright](#testes-e2e-com-playwright)
2. [Validação de Código](#validação-de-código)
3. [Health Check Automatizado](#health-check-automatizado)
4. [Git Hooks (Husky)](#git-hooks-husky)
5. [Dependabot (Atualizações Automáticas)](#dependabot-atualizações-automáticas)
6. [Segurança](#segurança)
7. [TypeScript](#typescript)

---

## 🧪 Testes E2E com Playwright

### Configuração

Arquivo: `playwright.config.ts`

**Recursos:**
- ✅ Timeouts otimizados (30s para testes, 10s para assertions)
- ✅ Retries automáticos (2x em CI, 1x local)
- ✅ Captura automática de screenshots e vídeos em falhas
- ✅ Relatórios HTML, JSON e JUnit
- ✅ Execução paralela otimizada
- ✅ Suporte a múltiplos navegadores (Chrome, Firefox, Safari)
- ✅ Suporte a dispositivos móveis

### Comandos Disponíveis

```bash
# Executar todos os testes
npm run test:e2e

# Executar com interface visual
npm run test:e2e:ui

# Executar em modo headed (ver navegador)
npm run test:e2e:headed

# Executar em modo debug
npm run test:e2e:debug

# Ver relatório HTML
npm run test:e2e:report

# Instalar navegadores do Playwright
npm run test:e2e:install

# Executar testes com análise automática
npm run test:e2e:auto

# Apenas gerar relatório de análise
npm run test:e2e:analyze

# Executar e tentar aplicar correções
npm run test:e2e:fix
```

### O Que É Capturado Automaticamente

Quando testes falham:
- 📸 **Screenshots** da página no momento do erro
- 🎥 **Vídeos** da execução completa
- 📝 **Logs** detalhados de erros
- 🔍 **Stack traces** completos
- 🎯 **Seletores** que falharam
- ⏱️ **Métricas** de performance

---

## ✅ Validação de Código

### Script Principal

Arquivo: `scripts/validar-codigo-completo.sh`

**Executa:**
1. ESLint (linting)
2. TypeScript type check
3. Build check
4. Verificação de vulnerabilidades

### Comandos

```bash
# Validação completa (inclui testes)
npm run validate

# Validação rápida (sem testes)
npm run validate:quick

# Executar manualmente
./scripts/validar-codigo-completo.sh

# Com auto-fix
./scripts/validar-codigo-completo.sh --fix

# Pular testes
./scripts/validar-codigo-completo.sh --skip-tests
```

### Validações Incluídas

- ✅ **ESLint**: Verifica qualidade e padrões de código
- ✅ **TypeScript**: Verifica tipos e erros de compilação
- ✅ **Build**: Verifica se o projeto compila corretamente
- ✅ **Security Audit**: Verifica vulnerabilidades nas dependências

---

## 🏥 Health Check Automatizado

### Script Principal

Arquivo: `scripts/health-check-completo.sh`

**Verifica:**
1. Ambiente (Node.js, npm, TypeScript)
2. Dependências (node_modules, vulnerabilidades)
3. Código (lint, type check)
4. Build (compilação)
5. Testes (configuração do Playwright)
6. Configuração (arquivos essenciais)
7. Docker (se aplicável)

### Comandos

```bash
# Health check completo
npm run health-check

# Com auto-fix
npm run health-check:fix

# Modo verbose (mais detalhes)
./scripts/health-check-completo.sh --verbose

# Executar manualmente
./scripts/health-check-completo.sh
```

### O Que É Verificado

- ✅ Node.js e npm instalados e funcionando
- ✅ Dependências instaladas
- ✅ Vulnerabilidades de segurança
- ✅ Código compila sem erros
- ✅ ESLint sem erros
- ✅ TypeScript sem erros de tipo
- ✅ Playwright configurado
- ✅ Arquivos de configuração presentes
- ✅ Docker (se aplicável)

---

## 🪝 Git Hooks (Husky)

### Pre-commit Hook

Arquivo: `.husky/pre-commit`

**Executa antes de cada commit:**
1. ESLint
2. TypeScript type check
3. Build check

**Bloqueia commit se:**
- ❌ ESLint encontrar erros
- ❌ TypeScript encontrar erros de tipo
- ❌ Build falhar

### Pre-push Hook

Arquivo: `.husky/pre-push`

**Executa antes de cada push:**
1. Verificação de vulnerabilidades (npm audit)
2. Verificação de testes E2E configurados

**Avisa (mas não bloqueia) se:**
- ⚠️ Vulnerabilidades encontradas
- ⚠️ Testes não configurados

### Configuração

```bash
# Instalar Husky (executado automaticamente no npm install)
npm run prepare

# Ou manualmente
npx husky install
```

### Lint-staged

Arquivo: `.lintstagedrc.json`

**Formata automaticamente:**
- Arquivos TypeScript/TSX antes do commit
- Arquivos JSON, Markdown, YAML antes do commit

---

## 🤖 Dependabot (Atualizações Automáticas)

### Configuração

Arquivo: `.github/dependabot.yml`

**Recursos:**
- ✅ Verifica atualizações semanalmente (segundas-feiras, 9h)
- ✅ Cria PRs automaticamente para atualizações
- ✅ Agrupa atualizações de patch e minor
- ✅ Ignora atualizações major (requerem revisão manual)
- ✅ Atualiza dependências npm e GitHub Actions

### O Que Faz

1. **Verifica atualizações** todas as segundas-feiras
2. **Cria PRs** para atualizações de segurança e patches
3. **Agrupa atualizações** para reduzir número de PRs
4. **Ignora majors** para evitar breaking changes

### Labels Aplicados

- `dependencies`: Atualizações de dependências
- `security`: Atualizações de segurança
- `github-actions`: Atualizações de GitHub Actions

---

## 🔒 Segurança

### NPM Audit

**Verifica vulnerabilidades nas dependências:**

```bash
# Verificar vulnerabilidades
npm run security:audit

# Corrigir automaticamente (quando possível)
npm run security:audit:fix

# Ou manualmente
npm audit
npm audit fix
```

### Dependabot

Ver seção [Dependabot](#dependabot-atualizações-automáticas) acima.

### Pre-commit e Pre-push Hooks

Ver seção [Git Hooks](#git-hooks-husky) acima.

---

## 📘 TypeScript

### Configuração Atual

Arquivo: `tsconfig.json`

**Configurações:**
- ✅ Path aliases (`@/*` → `./src/*`)
- ✅ Permissivo (para compatibilidade com código existente)
- ⚠️ `strictNullChecks: false` (pode ser habilitado gradualmente)
- ⚠️ `noImplicitAny: false` (pode ser habilitado gradualmente)

### Type Check

```bash
# Verificar tipos sem compilar
npm run type-check

# Ou manualmente
npx tsc --noEmit
```

### Recomendações Futuras

Para melhorar segurança de tipos gradualmente:
1. Habilitar `strictNullChecks` em novos arquivos
2. Habilitar `noImplicitAny` em novos arquivos
3. Corrigir tipos existentes gradualmente

---

## 🚀 Fluxo de Trabalho Recomendado

### Desenvolvimento Diário

```bash
# 1. Fazer mudanças no código
# 2. Validar antes de commit
npm run validate:quick

# 3. Fazer commit (hooks executam automaticamente)
git commit -m "feat: nova funcionalidade"

# 4. Antes de push, verificar saúde
npm run health-check

# 5. Fazer push (hooks executam automaticamente)
git push
```

### Antes de Deploy

```bash
# 1. Validação completa
npm run validate

# 2. Health check
npm run health-check

# 3. Testes E2E
npm run test:e2e:auto

# 4. Verificar relatórios
# - test-results/analysis/fix-suggestions.html
# - test-results/html-report/index.html

# 5. Se tudo OK, fazer deploy
```

### Semanalmente

```bash
# 1. Verificar atualizações do Dependabot
# (PRs são criados automaticamente)

# 2. Revisar e aprovar PRs de segurança

# 3. Executar health check completo
npm run health-check --verbose

# 4. Verificar vulnerabilidades
npm run security:audit
```

---

## 📊 Resumo de Ferramentas

| Ferramenta | Arquivo | Comando | Quando Usar |
|------------|---------|---------|-------------|
| **Playwright** | `playwright.config.ts` | `npm run test:e2e:auto` | Testes E2E completos |
| **Validação** | `scripts/validar-codigo-completo.sh` | `npm run validate` | Antes de commit/deploy |
| **Health Check** | `scripts/health-check-completo.sh` | `npm run health-check` | Verificar saúde do sistema |
| **Husky** | `.husky/pre-commit` | Automático | Antes de cada commit |
| **Dependabot** | `.github/dependabot.yml` | Automático | Atualizações semanais |
| **Security Audit** | `package.json` | `npm run security:audit` | Verificar vulnerabilidades |

---

## 🎯 Benefícios

### Segurança
- ✅ Detecção automática de vulnerabilidades
- ✅ Atualizações automáticas de dependências
- ✅ Validação antes de commit/push
- ✅ Type safety com TypeScript

### Agilidade
- ✅ Testes automatizados
- ✅ Validação rápida de código
- ✅ Health check rápido
- ✅ Correções automáticas quando possível

### Precisão
- ✅ Testes E2E com captura completa de erros
- ✅ Type checking rigoroso
- ✅ Linting consistente
- ✅ Relatórios detalhados

---

## 📚 Documentação Adicional

- [Regras de Testes](./REGRAS-TESTES-AUTOMATICOS.md)
- [Regras do Cursor](./.cursorrules)
- [Checklist de Deploy](./CHECKLIST-DEPLOY.md)

---

**Última atualização:** 2025-01-XX  
**Mantido por:** Equipe de Desenvolvimento






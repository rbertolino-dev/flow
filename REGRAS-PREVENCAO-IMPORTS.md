# 🛡️ Regras de Prevenção de Imports Duplicados

## ⚠️ REGRA CRÍTICA: NUNCA Importar o Mesmo Módulo Duas Vezes

**O Cursor DEVE SEMPRE consolidar imports do mesmo módulo em um único import, SEM criar imports duplicados.**

## 🔍 Verificações Automáticas Implementadas

### 1. Script de Verificação (`scripts/validar-imports.sh`)

**SEMPRE** executar antes de fazer commit:

```bash
# Verificar arquivo específico
./scripts/validar-imports.sh src/pages/Budgets.tsx

# Verificar todo o diretório
./scripts/validar-imports.sh src

# Verificar apenas arquivos modificados
git diff --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs ./scripts/validar-imports.sh
```

### 2. Pre-commit Hook Automático

**O hook executa automaticamente antes de cada commit:**
- ✅ Verifica imports duplicados nos arquivos staged
- ❌ **BLOQUEIA** commit se encontrar imports duplicados
- 📝 Mostra qual arquivo e linha tem o problema

### 3. Regra ESLint (`no-duplicate-imports`)

**Regra adicionada no `eslint.config.js`:**
- ✅ Detecta imports duplicados do mesmo módulo
- ❌ **FALHA** no lint** se encontrar imports duplicados

## 📋 Padrões Obrigatórios

### ❌ ERRADO (Imports Duplicados):

```typescript
// ❌ ERRADO - Import duplicado de lucide-react
import { Plus, Search, X } from 'lucide-react';
import { Package } from 'lucide-react';
import { Trash2 } from 'lucide-react';

// ❌ ERRADO - Import duplicado de @/types/budget
import { Budget, Service } from '@/types/budget';
import type { Budget as BudgetType } from '@/types/budget';
```

### ✅ CORRETO (Imports Consolidados):

```typescript
// ✅ CORRETO - Todos os imports de lucide-react em um único import
import { Plus, Search, X, Package, Trash2 } from 'lucide-react';

// ✅ CORRETO - Imports de @/types/budget consolidados
import { Budget, Service, type Budget as BudgetType } from '@/types/budget';
```

## 🔧 Como Consolidar Imports

### Passo 1: Identificar Imports Duplicados

```bash
# Executar verificação
./scripts/validar-imports.sh src/pages/Budgets.tsx
```

### Passo 2: Consolidar Manualmente

**Antes:**
```typescript
import { Plus } from 'lucide-react';
import { Package } from 'lucide-react';
import { Trash2 } from 'lucide-react';
```

**Depois:**
```typescript
import { Plus, Package, Trash2 } from 'lucide-react';
```

### Passo 3: Verificar Novamente

```bash
./scripts/validar-imports.sh src/pages/Budgets.tsx
# Deve retornar: ✅ Nenhum import duplicado encontrado!
```

## 🚫 O Que NUNCA Fazer

1. ❌ **NUNCA** importar o mesmo módulo duas vezes
2. ❌ **NUNCA** fazer commit sem verificar imports duplicados
3. ❌ **NUNCA** usar `--no-verify` para pular verificações (exceto casos especiais)
4. ❌ **NUNCA** ignorar avisos do pre-commit hook sobre imports duplicados

## ✅ Checklist Antes de Commit

- [ ] Executei `./scripts/validar-imports.sh` nos arquivos modificados
- [ ] Não há imports duplicados
- [ ] ESLint passa sem erros (`npm run lint`)
- [ ] TypeScript compila sem erros (`npm run type-check`)
- [ ] Build funciona (`npm run build`)

## 🔄 Fluxo Automático

```
Você modifica arquivo
    ↓
Faz git add
    ↓
Tenta fazer commit
    ↓
Pre-commit hook executa:
  1. Verifica imports duplicados (scripts/validar-imports.sh)
  2. Executa ESLint
  3. Verifica tipos TypeScript
  4. Verifica build
    ↓
✅ Se tudo OK → Commit prossegue
❌ Se imports duplicados → Commit BLOQUEADO
    ↓
Corrige imports duplicados
    ↓
Tenta commit novamente
    ↓
✅ Commit bem-sucedido
```

## 📚 Documentação Relacionada

- `PREVENCAO-IMPORTS-DUPLICADOS.md` - Documentação completa
- `scripts/validar-imports.sh` - Script de verificação
- `.husky/pre-commit` - Hook de pre-commit
- `eslint.config.js` - Configuração ESLint

## 🆘 Troubleshooting

### Pre-commit bloqueia commit por imports duplicados

**Solução:**
1. Execute: `./scripts/validar-imports.sh [arquivo]`
2. Veja quais imports estão duplicados
3. Consolide os imports em um único import
4. Execute novamente: `./scripts/validar-imports.sh [arquivo]`
5. Faça commit novamente

### Script não executa

```bash
# Dar permissão de execução
chmod +x scripts/validar-imports.sh
```

### Falsos positivos

Se o script detectar um falso positivo:
1. Verifique se realmente são imports duplicados
2. Se forem imports diferentes do mesmo módulo, consolide-os
3. Se houver caso especial, documente e ajuste o script

## ✅ Resumo das Regras

1. ✅ **SEMPRE** consolidar imports do mesmo módulo em um único import
2. ✅ **SEMPRE** verificar imports antes de fazer commit
3. ✅ **SEMPRE** seguir padrão: `import { a, b, c } from 'module'`
4. ✅ **NUNCA** importar o mesmo módulo duas vezes
5. ✅ **NUNCA** fazer commit sem verificar imports duplicados

**Seguindo essas regras, imports duplicados não ocorrerão mais!** 🎯



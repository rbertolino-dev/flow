# 🛡️ Prevenção de Imports Duplicados

## 📋 Problema

Imports duplicados causam:
- ❌ Erros de build
- ❌ Conflitos de namespace
- ❌ Aumento desnecessário do bundle
- ❌ Confusão no código

## ✅ Soluções Implementadas

### 1. Script de Verificação Automática

**Script:** `scripts/verificar-imports-duplicados.sh`

**Uso:**
```bash
# Verificar arquivo específico
./scripts/verificar-imports-duplicados.sh src/pages/Budgets.tsx

# Verificar todo o diretório src
./scripts/verificar-imports-duplicados.sh src

# Verificar arquivos modificados (antes de commit)
git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs ./scripts/verificar-imports-duplicados.sh
```

**O que detecta:**
- ✅ Imports duplicados exatos (mesmo módulo importado duas vezes)
- ✅ Múltiplos imports do mesmo módulo
- ✅ Imports com diferentes nomes do mesmo módulo

### 2. Pre-commit Hook Automático

**Arquivo:** `.husky/pre-commit`

O hook executa automaticamente antes de cada commit:
1. ✅ Verifica imports duplicados
2. ✅ Executa ESLint
3. ✅ Verifica tipos TypeScript
4. ✅ Verifica build

**Se encontrar imports duplicados:**
- ❌ Commit é **BLOQUEADO**
- 📝 Mensagem clara indicando qual arquivo e linha
- 💡 Instruções para corrigir

### 3. Verificação no Build

O build do Vite/TypeScript também detecta alguns erros de imports duplicados, mas o script é mais específico e detecta antes.

## 🔧 Como Usar

### Verificação Manual

```bash
# Antes de fazer commit, verificar:
./scripts/verificar-imports-duplicados.sh src

# Ou verificar apenas arquivos modificados:
git diff --name-only | grep -E '\.(ts|tsx|js|jsx)$' | while read file; do
  ./scripts/verificar-imports-duplicados.sh "$file"
done
```

### Correção Automática (quando possível)

Alguns casos podem ser corrigidos automaticamente:

```bash
# Executar ESLint com auto-fix (pode corrigir alguns imports)
npm run lint:fix
```

## 📝 Exemplos de Erros Detectados

### ❌ ERRADO (Import Duplicado):

```typescript
import { CreateProductDialog } from '@/components/shared/CreateProductDialog';
import { Product } from '@/types/product';
import { Package } from 'lucide-react';
import { CreateProductDialog } from '@/components/shared/CreateProductDialog'; // ❌ DUPLICADO
import { Product } from '@/types/product'; // ❌ DUPLICADO
import { Package } from 'lucide-react'; // ❌ DUPLICADO
```

### ✅ CORRETO (Import Único):

```typescript
import { CreateProductDialog } from '@/components/shared/CreateProductDialog';
import { ProductBulkImport } from '@/components/shared/ProductBulkImport';
import { Product } from '@/types/product';
import { Package } from 'lucide-react';
```

## 🚫 O Que NUNCA Fazer

1. ❌ **NUNCA** importar o mesmo módulo duas vezes
2. ❌ **NUNCA** fazer commit sem verificar imports duplicados
3. ❌ **NUNCA** usar `--no-verify` para pular verificações (exceto em casos especiais)
4. ❌ **NUNCA** ignorar avisos do pre-commit hook

## ✅ Padrões Obrigatórios

1. ✅ **SEMPRE** verificar imports antes de fazer commit
2. ✅ **SEMPRE** consolidar imports duplicados em um único import
3. ✅ **SEMPRE** usar o script de verificação antes de fazer commit
4. ✅ **SEMPRE** corrigir imports duplicados quando detectados

## 🔍 Verificação no CI/CD (Futuro)

Para adicionar verificação no CI/CD:

```yaml
# .github/workflows/ci.yml (exemplo)
- name: Verificar imports duplicados
  run: ./scripts/verificar-imports-duplicados.sh src
```

## 📚 Documentação Relacionada

- `REGRAS-DEPLOY-SEGURO.md` - Regras de deploy
- `.husky/pre-commit` - Hook de pre-commit
- `package.json` - Scripts disponíveis

## 🆘 Troubleshooting

### Script não executa

```bash
# Dar permissão de execução
chmod +x scripts/verificar-imports-duplicados.sh
```

### Pre-commit não está executando

```bash
# Reinstalar Husky
npm run prepare
```

### Falsos positivos

Se o script detectar um falso positivo, verifique:
1. Se realmente são imports duplicados
2. Se podem ser consolidados
3. Se há algum caso especial que precisa ser tratado

## ✅ Checklist Antes de Commit

- [ ] Executei `./scripts/verificar-imports-duplicados.sh src`
- [ ] Não há imports duplicados
- [ ] ESLint passa sem erros
- [ ] TypeScript compila sem erros
- [ ] Build funciona corretamente

**Seguindo essas práticas, imports duplicados não ocorrerão mais!** 🎯


# 🛡️ Regras de Deploy Seguro

## ⚠️ REGRA CRÍTICA: Confirmação Obrigatória

**NUNCA faça deploy sem usar a flag `--confirm`!**

O script de deploy agora **REQUER** confirmação explícita:

```bash
# ✅ CORRETO - Com confirmação
./scripts/deploy-zero-downtime.sh --confirm

# ❌ ERRADO - Sem confirmação (será bloqueado)
./scripts/deploy-zero-downtime.sh
```

## 📋 Checklist Antes de Fazer Deploy

### 1. ✅ Verificar Mudanças Locais

**SEMPRE** verificar se há mudanças não commitadas:

```bash
git status
```

**Se houver mudanças:**
- ❌ **NÃO fazer deploy** sem commit + push
- ✅ Fazer commit: `git add . && git commit -m "mensagem"`
- ✅ Fazer push: `git push origin main`
- ✅ **DEPOIS** fazer deploy

### 2. ✅ Verificar Código no GitHub

**SEMPRE** verificar se o código está no GitHub:

```bash
# Verificar último commit local vs remoto
git log --oneline -1
git log origin/main --oneline -1

# Se diferentes, fazer push primeiro
git push origin main
```

### 3. ✅ Revisar o Que Será Deployado

O script mostra automaticamente:
- Últimos commits que serão deployados
- Arquivos modificados
- Branch atual
- Commit hash

**REVISE** antes de confirmar!

### 4. ✅ Usar Flag --confirm

**SEMPRE** usar a flag `--confirm`:

```bash
./scripts/deploy-zero-downtime.sh --confirm
```

## 🔒 Proteções Implementadas

### 1. Confirmação Obrigatória
- Script **BLOQUEIA** deploy sem `--confirm`
- Força você a revisar o que será deployado

### 2. Verificação de Mudanças Não Commitadas
- Script **BLOQUEIA** deploy se houver mudanças locais não commitadas
- Força commit + push antes de deployar

### 3. Sincronização Git Obrigatória
- Script **SEMPRE** faz `git pull` antes do build
- Garante que código do GitHub é usado no build
- Evita deployar código local não publicado

### 4. Resumo Antes do Deploy
- Script mostra resumo completo do que será deployado
- Últimos commits
- Arquivos modificados
- Branch e commit atual

## 🚫 O Que NUNCA Fazer

1. ❌ **NUNCA** fazer deploy sem `--confirm`
2. ❌ **NUNCA** fazer deploy com mudanças não commitadas
3. ❌ **NUNCA** fazer deploy sem revisar o resumo
4. ❌ **NUNCA** usar `--skip-git-check` sem necessidade extrema
5. ❌ **NUNCA** fazer deploy sem push para GitHub

## ✅ Fluxo Correto de Deploy

```
1. Desenvolver e testar localmente
   ↓
2. Verificar mudanças: git status
   ↓
3. Commit: git add . && git commit -m "mensagem"
   ↓
4. Push: git push origin main
   ↓
5. Verificar no GitHub que código está lá
   ↓
6. Revisar o que será deployado
   ↓
7. Deploy com confirmação: ./scripts/deploy-zero-downtime.sh --confirm
   ↓
8. Verificar que deploy foi bem-sucedido
```

## 🔍 Verificações Automáticas do Script

O script faz automaticamente:

1. ✅ Verifica se há mudanças não commitadas (BLOQUEIA se houver)
2. ✅ Verifica se commits locais foram pushados (AVISA se não)
3. ✅ Faz `git fetch` para atualizar referências
4. ✅ Faz `git pull` para sincronizar código
5. ✅ Mostra resumo do que será deployado
6. ✅ Verifica redundante após pull
7. ✅ Garante que código do GitHub é usado no build

## 📝 Exemplo de Uso Correto

```bash
# 1. Verificar status
git status

# 2. Se houver mudanças, commit + push
git add .
git commit -m "feat: adicionar nova funcionalidade"
git push origin main

# 3. Verificar que está no GitHub
git log origin/main --oneline -1

# 4. Fazer deploy com confirmação
./scripts/deploy-zero-downtime.sh --confirm

# 5. Script mostrará resumo e pedirá confirmação
# 6. Após revisar, deploy prossegue automaticamente
```

## 🆘 Se Algo Der Errado

### Deploy Bloqueado por Mudanças Não Commitadas

```
Erro: Há mudanças locais não commitadas!
```

**Solução:**
```bash
git add .
git commit -m "Sua mensagem"
git push origin main
./scripts/deploy-zero-downtime.sh --confirm
```

### Deploy Bloqueado por Falta de Confirmação

```
Erro: DEPLOY REQUER CONFIRMAÇÃO EXPLÍCITA!
```

**Solução:**
```bash
# Adicionar flag --confirm
./scripts/deploy-zero-downtime.sh --confirm
```

### Código Não Está no GitHub

**Solução:**
```bash
# Verificar se está no GitHub
git log origin/main --oneline -1

# Se não estiver, fazer push
git push origin main

# Depois fazer deploy
./scripts/deploy-zero-downtime.sh --confirm
```

## 📚 Documentação Relacionada

- `ZERO-DOWNTIME-DEPLOY.md` - Documentação completa do deploy zero-downtime
- `COMO-FAZER-DEPLOY-CORRETO.md` - Guia passo a passo
- `PROTECAO-DEPLOY-INCORRETO.md` - Sistema de proteção

## ✅ Resumo das Regras

1. ✅ **SEMPRE** usar `--confirm` para fazer deploy
2. ✅ **SEMPRE** fazer commit + push antes de deployar
3. ✅ **SEMPRE** revisar resumo antes de confirmar
4. ✅ **SEMPRE** verificar que código está no GitHub
5. ✅ **NUNCA** fazer deploy sem confirmação
6. ✅ **NUNCA** fazer deploy com mudanças não commitadas

**Essas regras garantem que:**
- ✅ Código sempre está no GitHub antes do deploy
- ✅ Você sempre sabe o que está sendo deployado
- ✅ Outros agentes sempre pegam as mudanças mais recentes
- ✅ Deploys são seguros e previsíveis


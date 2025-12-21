# 🚀 Regras de Deploy Melhoradas - Prevenção de Problemas

## ⚠️ Problema Identificado

**Situação:** Deploys não estavam aplicando mudanças porque código não estava commitado e publicado no GitHub antes do build.

**Causa:** Código modificado localmente mas não commitado → Deploy faz build do código antigo do GitHub → Mudanças não aparecem no ar.

## ✅ Soluções Implementadas

### 1. Verificação Rigorosa de Mudanças Não Commitadas

**ANTES:**
- Verificação básica que podia ser ignorada
- Mensagem de erro não era clara o suficiente

**AGORA:**
- ✅ Verificação mais rigorosa com contagem de arquivos
- ✅ Lista de arquivos modificados (primeiros 20)
- ✅ Mensagens de erro mais claras e específicas
- ✅ Explicação do problema e soluções
- ✅ **BLOQUEIO OBRIGATÓRIO** - deploy não continua se houver mudanças não commitadas

### 2. Verificação Pré-Build de Sincronização

**NOVO:**
- ✅ Verifica que código local = código do GitHub ANTES do build
- ✅ Se não estiver sincronizado, faz pull automático
- ✅ Se pull falhar, CANCELA o build
- ✅ Registra commit exato que será buildado (para rastreabilidade)

### 3. Modo Auto-Commit (Opcional)

**NOVO:**
- ✅ Opção `--auto-commit "mensagem"` para fazer commit automático
- ✅ Útil quando você tem certeza das mudanças
- ✅ Faz: `git add .` → `git commit` → `git push` → continua deploy
- ⚠️ Use com cuidado - apenas quando tiver certeza

## 📋 Regras Obrigatórias

### Regra 1: SEMPRE Commit + Push Antes de Deploy

**O que fazer:**
```bash
# 1. Adicionar mudanças
git add .

# 2. Fazer commit
git commit -m "feat: descrição clara das mudanças"

# 3. Publicar no GitHub
git push origin main

# 4. Fazer deploy
./scripts/deploy-zero-downtime.sh
```

**Por quê:**
- ✅ Garante que código no ar = código no GitHub
- ✅ Outros agentes pegam as mudanças no próximo deploy
- ✅ Rastreabilidade completa (sabemos exatamente o que foi deployado)

### Regra 2: NUNCA Usar --skip-git-check (Exceto Emergências)

**Quando usar:**
- ❌ NUNCA em desenvolvimento normal
- ✅ APENAS em emergências (servidor sem acesso ao GitHub temporariamente)

**Por quê:**
- `--skip-git-check` pula TODAS as verificações
- Pode causar deploys de código incorreto
- Pode causar inconsistências entre agentes

### Regra 3: Verificar Status Antes de Deploy

**Sempre execute:**
```bash
# Verificar se há mudanças não commitadas
git status

# Se houver mudanças, commit + push primeiro
git add .
git commit -m "sua mensagem"
git push origin main

# Depois fazer deploy
./scripts/deploy-zero-downtime.sh
```

## 🔍 Verificações Automáticas do Script

O script agora faz **7 verificações obrigatórias**:

1. ✅ **HEAD em branch válido** (não detached)
2. ✅ **Branch correto** (main/master - aviso se não for)
3. ✅ **Repositório válido** (não corrompido)
4. ✅ **Commits não pushados** (aviso, não bloqueia)
5. ✅ **Mudanças não commitadas** (BLOQUEIA se houver)
6. ✅ **Sincronização com GitHub** (fetch + pull)
7. ✅ **Verificação redundante** (confirma sincronização)

**PLUS:** Verificação pré-build adicional:
- ✅ Código local = código remoto ANTES do build
- ✅ Pull automático se necessário
- ✅ Cancelamento se não conseguir sincronizar

## 🎯 Fluxo Correto de Deploy

```
1. Desenvolver funcionalidade
   ↓
2. Testar localmente
   ↓
3. git add .
   ↓
4. git commit -m "descrição"
   ↓
5. git push origin main
   ↓
6. ./scripts/deploy-zero-downtime.sh
   ↓
7. Script verifica:
   - ✅ Código commitado? SIM
   - ✅ Código no GitHub? SIM
   - ✅ Código sincronizado? SIM
   - ✅ Pode fazer build? SIM
   ↓
8. Build com código correto
   ↓
9. Deploy zero-downtime
   ↓
10. ✅ Funcionalidade no ar!
```

## 🚨 O Que NUNCA Fazer

1. ❌ **NUNCA** fazer deploy sem commit + push primeiro
2. ❌ **NUNCA** usar `--skip-git-check` sem necessidade real
3. ❌ **NUNCA** ignorar avisos de mudanças não commitadas
4. ❌ **NUNCA** fazer deploy de código que não está no GitHub

## 💡 Dicas

### Se Esqueceu de Fazer Commit

**Opção 1 (Recomendado):**
```bash
# Fazer commit manual
git add .
git commit -m "sua mensagem"
git push origin main
./scripts/deploy-zero-downtime.sh
```

**Opção 2 (Rápido, mas use com cuidado):**
```bash
# Commit automático
./scripts/deploy-zero-downtime.sh --auto-commit "sua mensagem"
```

### Verificar o Que Será Deployado

```bash
# Ver último commit que será deployado
git log -1

# Ver diferenças com GitHub
git fetch origin main
git log HEAD..origin/main

# Ver status
git status
```

## 📊 Monitoramento

O script agora registra:
- ✅ Commit exato que foi buildado
- ✅ Mensagem do commit
- ✅ Autor e data
- ✅ Hash do commit (para rastreabilidade)

Isso permite verificar exatamente qual código está no ar.

## ✅ Garantias

Com essas melhorias, o script garante:

1. ✅ **Código no ar = Código no GitHub** (sempre)
2. ✅ **Mudanças não commitadas não sobem** (bloqueio obrigatório)
3. ✅ **Sincronização verificada antes do build** (verificação pré-build)
4. ✅ **Rastreabilidade completa** (sabemos exatamente o que foi deployado)
5. ✅ **Consistência entre agentes** (todos pegam código do GitHub)

## 🔄 Próximos Passos

Se ainda houver problemas:
1. Verificar logs do deploy: `/tmp/deploy-*.log`
2. Verificar commit buildado: `git log -1`
3. Verificar código no container: `docker exec kanban-buzz-app-green ls -la /usr/share/nginx/html/`
4. Verificar se mudanças estão no GitHub: `git log origin/main -5`

---

**Última atualização:** 2025-12-21
**Versão do script:** Melhorada com verificações rigorosas


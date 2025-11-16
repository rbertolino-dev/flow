# 📝 Como Fazer Commit no Git

## 🎯 Passo a Passo Simples

### 1️⃣ Ver o que mudou
```bash
git status
```
Mostra quais arquivos foram modificados, adicionados ou deletados.

### 2️⃣ Adicionar arquivos ao commit
```bash
# Adicionar TODOS os arquivos modificados
git add .

# OU adicionar arquivo específico
git add nome-do-arquivo.tsx
```

### 3️⃣ Fazer o commit
```bash
git commit -m "Descrição do que foi feito"
```

**Exemplo:**
```bash
git commit -m "feat: Adiciona formulario de boletos"
```

### 4️⃣ Ver commits feitos
```bash
git log --oneline -5
```
Mostra os últimos 5 commits.

---

## 📋 Tipos de Mensagem de Commit

### Convenções comuns:

**feat:** Nova funcionalidade
```bash
git commit -m "feat: Adiciona geracao de boletos"
```

**fix:** Correção de bug
```bash
git commit -m "fix: Corrige erro ao salvar boleto"
```

**docs:** Documentação
```bash
git commit -m "docs: Adiciona guia de uso"
```

**style:** Formatação (sem mudança de código)
```bash
git commit -m "style: Formata codigo"
```

**refactor:** Refatoração
```bash
git commit -m "refactor: Melhora estrutura do componente"
```

**test:** Testes
```bash
git commit -m "test: Adiciona testes de boleto"
```

---

## 🔍 Comandos Úteis

### Ver diferenças antes de commitar
```bash
git diff
```
Mostra o que mudou linha por linha.

### Ver status resumido
```bash
git status --short
```
Versão compacta do status.

### Desfazer último commit (mantém mudanças)
```bash
git reset --soft HEAD~1
```

### Ver histórico
```bash
git log --oneline
```

---

## ✅ Exemplo Completo

```bash
# 1. Ver o que mudou
git status

# 2. Adicionar tudo
git add .

# 3. Fazer commit
git commit -m "feat: Integra formulario de boletos na interface"

# 4. Ver se funcionou
git log --oneline -1
```

---

## 🚀 Depois do Commit

### Enviar para GitHub
```bash
git push
```

### Ver commits locais que ainda não foram enviados
```bash
git log origin/main..HEAD
```

---

## 💡 Dicas

1. **Faça commits frequentes** - Não espere muito tempo
2. **Mensagens claras** - Descreva o que foi feito
3. **Commits pequenos** - Uma funcionalidade por commit
4. **Sempre verifique** - Use `git status` antes de commitar

---

## ⚠️ Erros Comuns

### "Nothing to commit"
- Não há mudanças para commitar
- Verifique se salvou os arquivos

### "Changes not staged"
- Arquivos modificados mas não adicionados
- Execute `git add .` primeiro

### "Untracked files"
- Arquivos novos que nunca foram commitados
- Adicione com `git add .`

---

**Pronto! Agora você sabe fazer commit! 🎉**


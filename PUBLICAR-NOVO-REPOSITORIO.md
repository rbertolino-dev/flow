# 📦 Como Publicar em um Novo Repositório GitHub (Sem Afetar o Original)

## Passo 1: Criar Novo Repositório no GitHub

1. Acesse: https://github.com/new
2. Preencha:
   - **Repository name**: escolha um nome (ex: `kanban-buzz-copia`)
   - **Description**: (opcional)
   - **Visibility**: Público ou Privado
   - ⚠️ **NÃO marque**: "Add a README file"
   - ⚠️ **NÃO marque**: "Add .gitignore"
   - ⚠️ **NÃO marque**: "Choose a license"
3. Clique em **"Create repository"**

## Passo 2: Copiar a URL do Novo Repositório

Após criar, o GitHub mostrará uma URL como:
```
https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
```

**Copie essa URL!**

## Passo 3: Executar os Comandos

Depois de criar o repositório no GitHub, execute os comandos abaixo substituindo `SUA_URL_AQUI` pela URL que você copiou:

```bash
# 1. Remover o remote original (não deleta o repositório, só a conexão local)
git remote remove origin

# 2. Adicionar o novo repositório como origin
git remote add origin SUA_URL_AQUI

# 3. Verificar se está correto
git remote -v

# 4. Fazer push para o novo repositório
git push -u origin main
```

## ✅ Pronto!

Agora seu projeto está publicado no novo repositório, e o repositório original continua intacto no GitHub.

---

## 🔄 Se Quiser Manter Ambos os Remotes

Se quiser manter conexão com AMBOS os repositórios (original e novo):

```bash
# Renomear o original para 'original'
git remote rename origin original

# Adicionar o novo como 'origin'
git remote add origin SUA_URL_AQUI

# Fazer push para o novo
git push -u origin main

# Se precisar fazer push no original depois:
# git push original main
```


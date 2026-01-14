# 🔐 Credenciais GitHub - Uso Automático pelo Cursor

## ✅ Token Configurado

O token do GitHub está armazenado de forma segura e pronto para uso automático pelo Cursor.

## 📁 Localização

- **Arquivo de credenciais:** `scripts/.github-credentials`
- **Permissões:** `600` (apenas leitura para o dono)
- **Status:** ✅ Não versionado (protegido no `.gitignore`)

## 🚀 Como Usar (Automático pelo Cursor)

### 1. Carregar Credenciais

```bash
# Carregar helper
source scripts/github-helper.sh

# Verificar se token está configurado
check_github_token
```

### 2. Fazer Push Automático

```bash
# Usar helper para push
source scripts/github-helper.sh
github_push main

# Ou usar script direto (carrega token automaticamente)
./scripts/push-to-github.sh
```

### 3. Obter Token em Scripts

```bash
source scripts/github-helper.sh
TOKEN=$(get_github_token)
echo "Token: $TOKEN"
```

## 📝 Informações do Token

- **Usuário:** `rbertolino-dev`
- **Repositório:** `flow`
- **Tipo:** Personal Access Token (PAT)
- **Escopo:** `repo` (acesso completo aos repositórios)

## 🔒 Segurança

- ✅ Token armazenado com permissões restritas (`600`)
- ✅ Arquivo não versionado (`.gitignore`)
- ✅ Token não aparece em logs ou comandos Git normais
- ✅ Usado apenas quando necessário (push/pull via HTTPS)

## 🔄 Atualizar Token

Se o token expirar ou precisar ser atualizado:

1. Editar `scripts/.github-credentials`
2. Atualizar `GITHUB_TOKEN` com o novo token
3. Salvar arquivo
4. Token será usado automaticamente nas próximas operações

## 📋 Scripts Disponíveis

### `scripts/github-helper.sh`
Helper com funções para usar token automaticamente:
- `load_github_credentials()` - Carrega credenciais
- `check_github_token()` - Verifica se token está configurado
- `github_push [branch]` - Faz push usando token
- `github_pull [branch]` - Faz pull usando token
- `get_github_token()` - Retorna token (para uso em scripts)

### `scripts/push-to-github.sh`
Script para fazer push, carrega token automaticamente do arquivo de credenciais.

## ⚠️ Nota Importante

O repositório atual está configurado para usar **SSH** (`git@github.com:rbertolino-dev/flow.git`), então o token não é necessário para operações Git normais.

O token está disponível para:
- Scripts que precisam fazer push/pull via HTTPS
- Operações via API do GitHub
- Quando necessário mudar para HTTPS temporariamente

## 🎯 Uso pelo Cursor

O Cursor pode usar o token automaticamente quando necessário:

```bash
# Exemplo: Fazer push via HTTPS usando token
source scripts/github-helper.sh
github_push main

# Exemplo: Usar token em script customizado
source scripts/github-helper.sh
TOKEN=$(get_github_token)
curl -H "Authorization: token $TOKEN" https://api.github.com/user
```

---

**Token atualizado em:** 2025-01-14  
**Status:** ✅ Configurado e pronto para uso

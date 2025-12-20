# 🚀 Migrações via SSH - Guia Completo

**Status:** ✅ Scripts Criados e Prontos  
**Data:** 17/12/2025

---

## 🎯 Visão Geral

Scripts automatizados para aplicar migrações e executar SQL no servidor via SSH usando credenciais salvas.

---

## 📋 Scripts Disponíveis

### 1. `aplicar-migrations-ssh.sh`

Aplica todas as migrations ou uma migration específica no servidor.

**Uso:**
```bash
# Aplicar todas as migrations
./scripts/aplicar-migrations-ssh.sh --all

# Aplicar migration específica
./scripts/aplicar-migrations-ssh.sh --file supabase/migrations/20251216000000_create_table.sql
```

**O que faz:**
1. ✅ Carrega credenciais SSH automaticamente
2. ✅ Conecta ao servidor via SSH
3. ✅ Carrega configuração Supabase no servidor
4. ✅ Linka projeto se necessário
5. ✅ Aplica migrations via `supabase db push`

---

### 2. `executar-sql-ssh.sh`

Executa um arquivo SQL específico no servidor.

**Uso:**
```bash
# Executar SQL
./scripts/executar-sql-ssh.sh arquivo.sql

# Simular execução (dry-run)
./scripts/executar-sql-ssh.sh arquivo.sql --dry-run
```

**Exemplos:**
```bash
# Executar migration específica
./scripts/executar-sql-ssh.sh supabase/migrations/20251216000000_create_table.sql

# Executar SQL de correção
./scripts/executar-sql-ssh.sh CORRECAO.sql

# Simular antes de executar
./scripts/executar-sql-ssh.sh arquivo.sql --dry-run
```

**O que faz:**
1. ✅ Carrega credenciais SSH automaticamente
2. ✅ Copia arquivo SQL para servidor
3. ✅ Carrega configuração Supabase no servidor
4. ✅ Linka projeto se necessário
5. ✅ Executa SQL via `supabase db execute`

---

## 🔐 Credenciais Usadas

As credenciais são carregadas automaticamente de:
- **Arquivo:** `scripts/.ssh-credentials`
- **User:** root
- **Host:** 95.217.2.116
- **Diretório:** /opt/app

**⚠️ IMPORTANTE:** O arquivo está no `.gitignore` e não é versionado.

---

## 📝 Exemplos de Uso

### Exemplo 1: Aplicar Todas as Migrations

```bash
./scripts/aplicar-migrations-ssh.sh --all
```

**O que acontece:**
1. Conecta ao servidor
2. Carrega configuração Supabase
3. Linka projeto se necessário
4. Executa `supabase db push`
5. Aplica todas as migrations pendentes

---

### Exemplo 2: Executar SQL Específico

```bash
./scripts/executar-sql-ssh.sh supabase/migrations/20251216000000_create_table.sql
```

**O que acontece:**
1. Copia arquivo para servidor
2. Conecta ao servidor
3. Carrega configuração Supabase
4. Linka projeto se necessário
5. Executa SQL via CLI

---

### Exemplo 3: Simular Antes de Executar

```bash
./scripts/executar-sql-ssh.sh arquivo.sql --dry-run
```

**O que acontece:**
1. Copia arquivo para servidor
2. Mostra conteúdo do arquivo
3. **NÃO executa** (apenas simula)
4. Permite revisar antes de aplicar

---

## ✅ Regras Seguidas

Todos os scripts seguem as regras do Supabase CLI:

1. ✅ **SEMPRE** carregam configuração primeiro
2. ✅ **SEMPRE** usam Supabase CLI (nunca dashboard)
3. ✅ **SEMPRE** verificam se projeto está linkado
4. ✅ **SEMPRE** linkam projeto se necessário
5. ✅ **NUNCA** executam SQL manualmente
6. ✅ **SEMPRE** usam credenciais salvas automaticamente

---

## 🔧 Troubleshooting

### Erro: "Credenciais SSH não configuradas"

```bash
# Verificar se arquivo existe
ls -la scripts/.ssh-credentials

# Se não existir, criar:
cat > scripts/.ssh-credentials << EOF
SSH_USER=root
SSH_PASSWORD=grkjuXfEbwaF
SSH_HOST=95.217.2.116
SSH_DIR=/opt/app
EOF
```

### Erro: "Projeto não linkado"

O script linka automaticamente, mas se falhar:

```bash
# No servidor
ssh root@95.217.2.116
cd /opt/app
source .supabase-cli-config
supabase link --project-ref [PROJECT_ID]
```

### Erro: "sshpass não encontrado"

O script instala automaticamente, mas se falhar:

```bash
apt-get update
apt-get install -y sshpass
```

---

## 📊 Fluxo Automatizado

```
Você executa: ./scripts/aplicar-migrations-ssh.sh --all
    ↓
Script carrega: source scripts/carregar-credenciais.sh
    ↓
Credenciais carregadas automaticamente
    ↓
Script conecta: sshpass -p [PASSWORD] ssh [USER]@[HOST]
    ↓
No servidor: source .supabase-cli-config
    ↓
No servidor: supabase link (se necessário)
    ↓
No servidor: supabase db push
    ↓
✅ Migrations aplicadas!
```

---

## ✅ Checklist

- [x] Scripts criados
- [x] Permissões configuradas
- [x] Credenciais salvas
- [x] Testado localmente
- [x] Pronto para uso

---

**🎉 Tudo pronto para aplicar migrações via SSH automaticamente!**


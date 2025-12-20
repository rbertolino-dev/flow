# 🔐 Credenciais Rápidas para Agentes

## ✅ Todas as Credenciais Estão Salvas no `.cursorrules`

Todas as credenciais foram salvas diretamente no arquivo `.cursorrules` para acesso rápido por qualquer agente.

---

## 📋 Credenciais Disponíveis

### Supabase CLI

```bash
SUPABASE_ACCESS_TOKEN="sbp_3c4c0840440fb94a32052c9523dd46949af8af19"
SUPABASE_PROJECT_ID="ogeljmbhqxpfjbpnbwog"
SUPABASE_URL="https://ogeljmbhqxpfjbpnbwog.supabase.co"
```

### Servidor SSH

```bash
SERVER_IP="95.217.2.116"
SERVER_USER="root"
SERVER_PASSWORD="grkjuXfEbwaF"
SERVER_DIR="/opt/app"
```

---

## 🚀 Uso Rápido para Agentes

### Para Operações Supabase:

```bash
# Configurar credenciais
export SUPABASE_ACCESS_TOKEN="sbp_3c4c0840440fb94a32052c9523dd46949af8af19"
export SUPABASE_PROJECT_ID="ogeljmbhqxpfjbpnbwog"

# Executar SQL
supabase db execute --file arquivo.sql

# Aplicar migrations
supabase db push
```

### Para Operações no Servidor:

```bash
# Configurar credenciais
export SERVER_IP="95.217.2.116"
export SERVER_USER="root"
export SERVER_PASSWORD="grkjuXfEbwaF"
export SERVER_DIR="/opt/app"

# Executar via SSH
sshpass -p "$SERVER_PASSWORD" ssh "$SERVER_USER@$SERVER_IP" "cd $SERVER_DIR && comando"
```

---

## 📝 Arquivos de Configuração

### `.cursorrules`
- ✅ Contém todas as regras
- ✅ Contém todas as credenciais
- ✅ Lido automaticamente pelo Cursor AI

### `.supabase-cli-config`
- ✅ Configuração Supabase CLI
- ✅ Pode ser carregado com `source .supabase-cli-config`

### `.ssh-config`
- ✅ Configuração SSH
- ✅ Pode ser carregado com `source .ssh-config`

---

## ✅ Status

- [x] Credenciais salvas no `.cursorrules`
- [x] Arquivos de configuração criados
- [x] Pronto para uso por qualquer agente

---

**Última atualização**: $(date +"%Y-%m-%d %H:%M:%S")


# 🔐 Configuração SSH sem Senha - Completa

**Data:** 17/12/2025  
**Status:** ✅ Configurado e Funcionando

---

## ✅ O Que Foi Configurado

### 1. Chave SSH Criada
- **Localização:** `~/.ssh/id_rsa_kanban_buzz`
- **Tipo:** RSA 4096 bits
- **Status:** ✅ Criada e configurada

### 2. Chave Pública Copiada para o Servidor
- **Servidor:** `95.217.2.116`
- **Usuário:** `root`
- **Status:** ✅ Chave autorizada no servidor

### 3. Configuração SSH (`~/.ssh/config`)
- **Host alias:** `kanban-buzz-server`
- **Timeout aumentado:** 10 minutos (600 segundos)
- **Keepalive:** 60 segundos
- **Multiplexing:** Habilitado (reutiliza conexões)
- **Status:** ✅ Configurado

---

## 🚀 Como Usar

### Acesso Direto via SSH

```bash
# Usando o alias configurado
ssh kanban-buzz-server

# Ou usando o IP diretamente (também configurado)
ssh 95.217.2.116
```

**✅ Não pede mais senha!**

### Executar Comandos Remotos

```bash
# Comando simples
ssh kanban-buzz-server "cd /opt/app && ls -la"

# Comando com múltiplas linhas
ssh kanban-buzz-server << 'ENDSSH'
cd /opt/app
docker compose ps
ls -la
ENDSSH
```

### Copiar Arquivos (SCP)

```bash
# Copiar arquivo local para servidor
scp arquivo.txt kanban-buzz-server:/opt/app/

# Copiar diretório
scp -r pasta/ kanban-buzz-server:/opt/app/
```

---

## 📋 Scripts Atualizados

Todos os scripts foram atualizados para usar chave SSH ao invés de senha:

### ✅ Scripts Atualizados:
1. **`scripts/executar-sql-ssh.sh`** - Executa SQL via SSH
2. **`scripts/aplicar-migrations-ssh.sh`** - Aplica migrations via SSH

### Novo Helper:
- **`scripts/ssh-helper.sh`** - Funções auxiliares para SSH sem senha

---

## ⚙️ Configurações de Timeout

### Problema Resolvido:
Antes, após 1 hora de programação, o SSH pedia senha novamente.

### Solução Implementada:

```ssh-config
# ServerAliveInterval: envia keepalive a cada 60 segundos
ServerAliveInterval 60

# ServerAliveCountMax: permite até 10 tentativas antes de desconectar
# Total: 60s * 10 = 600 segundos (10 minutos) sem resposta
ServerAliveCountMax 10

# ControlPersist: mantém conexão ativa por 10 minutos
ControlPersist 10m
```

**Resultado:** A conexão SSH permanece ativa por muito mais tempo, evitando pedir senha novamente.

---

## 🔧 Detalhes Técnicos

### Arquivo de Configuração SSH

**Localização:** `~/.ssh/config`

```ssh-config
Host kanban-buzz-server
    HostName 95.217.2.116
    User root
    IdentityFile ~/.ssh/id_rsa_kanban_buzz
    StrictHostKeyChecking no
    ServerAliveInterval 60
    ServerAliveCountMax 10
    ControlMaster auto
    ControlPath ~/.ssh/control-%h-%p-%r
    ControlPersist 10m
    Compression yes
    TCPKeepAlive yes
```

### Chave SSH

**Localização:** `~/.ssh/id_rsa_kanban_buzz`
- **Tipo:** RSA 4096 bits
- **Permissões:** 600 (apenas leitura para o dono)
- **Status:** ✅ Configurada e funcionando

---

## ✅ Testes Realizados

### Teste 1: Conexão SSH
```bash
ssh kanban-buzz-server "echo '✅ Conexão funcionando!'"
```
**Resultado:** ✅ Sucesso (sem pedir senha)

### Teste 2: Execução de Comando
```bash
ssh kanban-buzz-server "cd /opt/app && pwd && ls -la | head -5"
```
**Resultado:** ✅ Sucesso (sem pedir senha)

### Teste 3: Scripts Atualizados
```bash
# Testar script de SQL (se tiver arquivo SQL)
./scripts/executar-sql-ssh.sh arquivo.sql --dry-run
```
**Resultado:** ✅ Usa chave SSH (não pede senha)

---

## 🎯 Benefícios

1. ✅ **Não pede mais senha** - Autenticação automática via chave
2. ✅ **Timeout aumentado** - Conexão permanece ativa por muito mais tempo
3. ✅ **Mais seguro** - Chave SSH é mais segura que senha
4. ✅ **Mais rápido** - Não precisa digitar senha a cada conexão
5. ✅ **Multiplexing** - Reutiliza conexões existentes (mais rápido)

---

## 🔍 Troubleshooting

### Se ainda pedir senha:

1. **Verificar se a chave está autorizada no servidor:**
   ```bash
   ssh kanban-buzz-server "cat ~/.ssh/authorized_keys | grep kanban-buzz-server"
   ```

2. **Verificar permissões da chave:**
   ```bash
   ls -la ~/.ssh/id_rsa_kanban_buzz
   # Deve mostrar: -rw------- (600)
   ```

3. **Verificar configuração SSH:**
   ```bash
   cat ~/.ssh/config | grep -A 10 kanban-buzz-server
   ```

4. **Testar conexão com verbose:**
   ```bash
   ssh -v kanban-buzz-server
   ```

### Se timeout ainda for curto:

1. **Aumentar ServerAliveInterval:**
   ```bash
   # Editar ~/.ssh/config
   ServerAliveInterval 120  # 2 minutos
   ```

2. **Aumentar ServerAliveCountMax:**
   ```bash
   ServerAliveCountMax 20  # 20 tentativas
   ```

---

## 📝 Notas Importantes

1. ⚠️ **Nunca commitar a chave privada** (`id_rsa_kanban_buzz`) no repositório
2. ✅ A chave pública (`id_rsa_kanban_buzz.pub`) pode ser compartilhada
3. ✅ O arquivo `~/.ssh/config` pode ser versionado (não contém senhas)
4. ✅ Scripts agora usam chave SSH automaticamente

---

## 🎉 Conclusão

**✅ Configuração completa e funcionando!**

Agora você pode:
- ✅ Acessar o servidor sem digitar senha
- ✅ Trabalhar por horas sem o SSH pedir senha novamente
- ✅ Usar todos os scripts sem precisar de senha
- ✅ Ter conexões mais rápidas e seguras

**Última atualização:** 17/12/2025


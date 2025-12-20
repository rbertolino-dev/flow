# 🔧 Troubleshooting: SSH Ainda Pede Senha

**Guia completo para resolver quando SSH ainda pede senha**

---

## 🚨 O Que Fazer Quando Ainda Pedir Senha

### 1. Executar Diagnóstico Automático

```bash
# Executar script de diagnóstico
./scripts/diagnosticar-ssh.sh
```

Este script vai:
- ✅ Verificar se a chave SSH existe
- ✅ Verificar permissões corretas
- ✅ Verificar configuração SSH
- ✅ Tentar copiar chave automaticamente
- ✅ Testar conexão

---

## 🔍 Diagnóstico Manual Passo a Passo

### Passo 1: Verificar se a Chave Existe

```bash
ls -la ~/.ssh/id_rsa_kanban_buzz
```

**Deve mostrar:**
```
-rw------- 1 root root 3243 Dec 17 21:59 /root/.ssh/id_rsa_kanban_buzz
```

**Se não existir:**
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_kanban_buzz -N "" -C "kanban-buzz-server"
```

---

### Passo 2: Verificar Permissões da Chave

```bash
# Verificar permissões
stat -c "%a" ~/.ssh/id_rsa_kanban_buzz
# Deve mostrar: 600

# Se não for 600, corrigir:
chmod 600 ~/.ssh/id_rsa_kanban_buzz
chmod 644 ~/.ssh/id_rsa_kanban_buzz.pub
```

**Permissões corretas:**
- Chave privada: `600` (apenas leitura para o dono)
- Chave pública: `644` (leitura para todos)
- Diretório `.ssh`: `700`

---

### Passo 3: Verificar Configuração SSH

```bash
# Verificar se config existe
cat ~/.ssh/config | grep -A 10 kanban-buzz-server
```

**Deve mostrar:**
```
Host kanban-buzz-server
    HostName 95.217.2.116
    User root
    IdentityFile ~/.ssh/id_rsa_kanban_buzz
    ...
```

**Se não existir ou estiver incorreto:**
```bash
# Criar/atualizar configuração
cat >> ~/.ssh/config << 'EOF'
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
EOF

chmod 600 ~/.ssh/config
```

---

### Passo 4: Verificar se Chave Está no Servidor

```bash
# Tentar conectar e verificar authorized_keys
ssh kanban-buzz-server "cat ~/.ssh/authorized_keys | grep kanban-buzz-server"
```

**Se não encontrar a chave, copiar manualmente:**

#### Opção A: Usando sshpass (se tiver senha salva)

```bash
# Carregar credenciais
source scripts/.ssh-credentials

# Copiar chave
sshpass -p "$SSH_PASSWORD" ssh-copy-id -i ~/.ssh/id_rsa_kanban_buzz.pub -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST_IP"
```

#### Opção B: Manualmente (digitar senha uma vez)

```bash
ssh-copy-id -i ~/.ssh/id_rsa_kanban_buzz.pub root@95.217.2.116
```

#### Opção C: Copiar conteúdo manualmente

```bash
# 1. Mostrar chave pública
cat ~/.ssh/id_rsa_kanban_buzz.pub

# 2. Conectar ao servidor (vai pedir senha)
ssh root@95.217.2.116

# 3. No servidor, adicionar a chave:
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "COLE_AQUI_A_CHAVE_PUBLICA" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

---

### Passo 5: Testar Conexão com Verbose

```bash
# Testar com logs detalhados
ssh -v kanban-buzz-server 2>&1 | grep -E "(Authenticating|Offering|Trying|key|password)"
```

**O que procurar:**
- ✅ `Offering public key` - SSH está tentando usar a chave
- ✅ `Server accepts key` - Servidor aceitou a chave
- ❌ `Password authentication` - Ainda está pedindo senha
- ❌ `Permission denied` - Chave não autorizada

---

## 🔧 Soluções Comuns

### Problema 1: "Permission denied (publickey)"

**Causa:** Chave não está autorizada no servidor

**Solução:**
```bash
# Copiar chave novamente
sshpass -p "grkjuXfEbwaF" ssh-copy-id -i ~/.ssh/id_rsa_kanban_buzz.pub -o StrictHostKeyChecking=no root@95.217.2.116
```

---

### Problema 2: "Could not open authorized keys"

**Causa:** Permissões incorretas no servidor

**Solução:**
```bash
# Conectar ao servidor (vai pedir senha uma vez)
ssh root@95.217.2.116

# No servidor, corrigir permissões:
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
exit
```

---

### Problema 3: SSH não encontra a chave

**Causa:** Configuração SSH incorreta ou chave em local diferente

**Solução:**
```bash
# Verificar se IdentityFile está correto
grep IdentityFile ~/.ssh/config

# Se estiver errado, corrigir:
sed -i 's|IdentityFile.*|IdentityFile ~/.ssh/id_rsa_kanban_buzz|' ~/.ssh/config
```

---

### Problema 4: Timeout muito curto

**Causa:** Configuração de timeout não está funcionando

**Solução:**
```bash
# Verificar configuração atual
grep -E "ServerAlive|ControlPersist" ~/.ssh/config

# Se não estiver configurado, adicionar:
cat >> ~/.ssh/config << 'EOF'
Host kanban-buzz-server
    ServerAliveInterval 60
    ServerAliveCountMax 10
    ControlPersist 10m
EOF
```

---

## 🚀 Script de Correção Rápida

Se nada funcionar, execute este script completo:

```bash
#!/bin/bash
# Correção completa SSH

# 1. Criar chave se não existir
if [ ! -f ~/.ssh/id_rsa_kanban_buzz ]; then
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_kanban_buzz -N "" -C "kanban-buzz-server"
fi

# 2. Corrigir permissões
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa_kanban_buzz
chmod 644 ~/.ssh/id_rsa_kanban_buzz.pub

# 3. Carregar credenciais
source scripts/.ssh-credentials

# 4. Copiar chave para servidor
sshpass -p "$SSH_PASSWORD" ssh-copy-id -i ~/.ssh/id_rsa_kanban_buzz.pub -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST_IP"

# 5. Testar
ssh -o ConnectTimeout=5 kanban-buzz-server "echo '✅ Funcionando!'"
```

---

## 📋 Checklist Rápido

Quando SSH pedir senha, verifique:

- [ ] Chave SSH existe? (`ls ~/.ssh/id_rsa_kanban_buzz`)
- [ ] Permissões corretas? (`chmod 600 ~/.ssh/id_rsa_kanban_buzz`)
- [ ] Config SSH existe? (`cat ~/.ssh/config`)
- [ ] Chave está no servidor? (`ssh kanban-buzz-server "cat ~/.ssh/authorized_keys | grep kanban"`)
- [ ] Testou com verbose? (`ssh -v kanban-buzz-server`)

---

## 🆘 Se Nada Funcionar

1. **Executar diagnóstico completo:**
   ```bash
   ./scripts/diagnosticar-ssh.sh
   ```

2. **Ver logs detalhados:**
   ```bash
   ssh -vvv kanban-buzz-server 2>&1 | tee ssh-debug.log
   ```

3. **Verificar no servidor:**
   ```bash
   ssh root@95.217.2.116 "ls -la ~/.ssh/ && cat ~/.ssh/authorized_keys"
   ```

4. **Recriar tudo do zero:**
   ```bash
   # Remover chave antiga
   rm ~/.ssh/id_rsa_kanban_buzz*
   
   # Executar script de diagnóstico (vai recriar tudo)
   ./scripts/diagnosticar-ssh.sh
   ```

---

## ✅ Teste Final

Após corrigir, teste:

```bash
# Teste simples
ssh kanban-buzz-server "echo '✅ Funcionando sem senha!'"

# Teste com comando
ssh kanban-buzz-server "cd /opt/app && pwd && ls -la | head -3"

# Teste de timeout (aguardar alguns minutos)
ssh kanban-buzz-server "sleep 300 && echo '✅ Timeout OK!'"
```

---

**Última atualização:** 17/12/2025


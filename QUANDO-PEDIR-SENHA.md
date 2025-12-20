# 🚨 O QUE FAZER QUANDO SSH PEDIR SENHA

## ⚡ Solução Rápida (1 comando)

```bash
./scripts/diagnosticar-ssh.sh
```

**Este script vai:**
- ✅ Verificar tudo automaticamente
- ✅ Corrigir problemas encontrados
- ✅ Copiar chave se necessário
- ✅ Testar conexão

---

## 🔧 Se o Script Não Resolver

### Opção 1: Copiar Chave Manualmente (1 vez)

```bash
# Carregar credenciais
source scripts/.ssh-credentials

# Copiar chave (vai pedir senha UMA ÚLTIMA VEZ)
sshpass -p "$SSH_PASSWORD" ssh-copy-id -i ~/.ssh/id_rsa_kanban_buzz.pub -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST_IP"
```

### Opção 2: Verificar o Que Está Errado

```bash
# Ver logs detalhados
ssh -v kanban-buzz-server 2>&1 | grep -E "(Authenticating|Offering|key|password)"
```

**O que procurar:**
- ✅ `Offering public key` = SSH está tentando usar a chave
- ✅ `Server accepts key` = Servidor aceitou
- ❌ `Password authentication` = Ainda pedindo senha (chave não autorizada)

---

## 📋 Checklist Rápido

Execute estes comandos na ordem:

```bash
# 1. Verificar se chave existe
ls -la ~/.ssh/id_rsa_kanban_buzz

# 2. Corrigir permissões (se necessário)
chmod 600 ~/.ssh/id_rsa_kanban_buzz
chmod 644 ~/.ssh/id_rsa_kanban_buzz.pub

# 3. Verificar configuração
cat ~/.ssh/config | grep kanban-buzz-server

# 4. Testar conexão
ssh kanban-buzz-server "echo 'OK'"
```

---

## 🆘 Se Nada Funcionar

1. **Executar diagnóstico completo:**
   ```bash
   ./scripts/diagnosticar-ssh.sh
   ```

2. **Ver documentação completa:**
   ```bash
   cat TROUBLESHOOTING-SSH-SENHA.md
   ```

3. **Recriar tudo do zero:**
   ```bash
   # Remover chave antiga
   rm ~/.ssh/id_rsa_kanban_buzz*
   
   # Executar diagnóstico (vai recriar)
   ./scripts/diagnosticar-ssh.sh
   ```

---

## ✅ Teste Final

Após corrigir, sempre teste:

```bash
ssh kanban-buzz-server "echo '✅ Funcionando sem senha!'"
```

**Se mostrar "✅ Funcionando sem senha!" = Tudo OK!**

---

**💡 Dica:** Execute `./scripts/diagnosticar-ssh.sh` sempre que SSH pedir senha. Ele resolve 99% dos problemas automaticamente!


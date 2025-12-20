# 🔍 Como Verificar se o DNS Está Configurado Corretamente

**Status**: ✅ DNS adicionado no registro.br

---

## 🚀 Verificação Rápida

### Opção 1: Usar o Script Automático

```bash
# Executar o script de verificação
./VERIFICAR-DNS-CONFIGURADO.sh [DOMINIO] [IP_HETZNER]

# Exemplo:
./VERIFICAR-DNS-CONFIGURADO.sh app.seudominio.com.br 123.45.67.89
```

O script vai verificar:
- ✅ Se o DNS está resolvendo
- ✅ Se está apontando para o IP correto
- ✅ Propagação global
- ✅ Conectividade HTTP

---

### Opção 2: Verificação Manual

#### 1. Verificar DNS Localmente

```bash
# Verificar se DNS está resolvendo
dig app.seudominio.com.br A

# OU
nslookup app.seudominio.com.br
```

**Resultado esperado:**
```
app.seudominio.com.br. 3600 IN A 123.45.67.89
```

#### 2. Verificar Propagação Global

Acesse: https://dnschecker.org

- Digite seu domínio
- Selecione tipo: **A**
- Clique em **Search**
- Verifique se está propagado em vários servidores DNS

#### 3. Verificar Conectividade

```bash
# Testar HTTP
curl -I http://app.seudominio.com.br

# Testar se IP está correto
curl -s ifconfig.me  # IP do servidor
dig +short app.seudominio.com.br  # IP do DNS
```

---

## ✅ O Que Verificar

### 1. DNS Está Resolvendo?

**Comando:**
```bash
dig app.seudominio.com.br A
```

**✅ Correto:**
```
app.seudominio.com.br. 3600 IN A 123.45.67.89
```

**❌ Errado:**
```
;; connection timed out; no servers could be reached
```

---

### 2. IP Está Correto?

**Comando:**
```bash
# Ver IP do servidor Hetzner
curl -s ifconfig.me

# Ver IP do DNS
dig +short app.seudominio.com.br A
```

**✅ Correto:**
- IP do servidor = IP do DNS

**❌ Errado:**
- IPs diferentes

---

### 3. Propagação Global

**Online:**
- https://dnschecker.org
- https://www.whatsmydns.net

**✅ Correto:**
- Maioria dos servidores DNS mostra o IP correto

**⏳ Propagando:**
- Alguns servidores ainda não atualizaram (normal nas primeiras horas)

---

## ⚠️ Problemas Comuns

### Problema: DNS não está resolvendo

**Possíveis causas:**
1. Registro não foi salvo no registro.br
2. Tipo de registro errado (deve ser A, não CNAME)
3. DNS ainda propagando (aguarde 1-2 horas)

**Solução:**
1. Verificar no registro.br se o registro está salvo
2. Verificar tipo e valor do registro
3. Aguardar propagação

---

### Problema: DNS aponta para IP diferente

**Possíveis causas:**
1. IP incorreto no registro.br
2. DNS ainda propagando
3. Cache DNS local

**Solução:**
1. Verificar IP no registro.br
2. Limpar cache DNS:
   ```bash
   # Linux
   sudo systemd-resolve --flush-caches
   
   # Mac
   sudo dscacheutil -flushcache
   
   # Windows
   ipconfig /flushdns
   ```
3. Aguardar propagação

---

### Problema: HTTP não está respondendo

**Possíveis causas:**
1. DNS ainda propagando
2. Nginx não está configurado no servidor
3. Firewall bloqueando portas 80/443
4. Servidor não está rodando

**Solução:**
1. Verificar se DNS está propagado
2. Verificar se Nginx está configurado
3. Verificar firewall:
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```
4. Verificar se servidor está rodando

---

## 📊 Checklist de Verificação

- [ ] DNS está resolvendo (`dig` ou `nslookup`)
- [ ] IP está correto (igual ao IP do servidor)
- [ ] Propagação global (maioria dos servidores DNS)
- [ ] HTTP respondendo (se Nginx já configurado)
- [ ] Firewall configurado (portas 80 e 443)

---

## 🎯 Próximos Passos

Após confirmar que DNS está OK:

1. ✅ **Configurar Nginx** no servidor Hetzner
2. ✅ **Configurar SSL** com Certbot
3. ✅ **Testar acesso** ao domínio

---

**Última atualização**: 15/12/2025 02:10




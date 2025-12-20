# 🌐 Configurar DNS no Registro.br para Supabase

**Projeto Supabase**: flow  
**Project ID**: ogeljmbhqxpfjbpnbwog  
**URL Atual**: https://ogeljmbhqxpfjbpnbwog.supabase.co

---

## 📋 O Que Configurar no Registro.br

Para usar um domínio customizado (ex: `seudominio.com.br`) com o Supabase, você precisa configurar os seguintes registros DNS:

---

## 🔧 Configuração de DNS

### Opção 1: Domínio Principal (Apex Domain)

Se você quer usar o domínio raiz (ex: `seudominio.com.br`):

#### Registros DNS Necessários:

**1. Registro CNAME (Recomendado):**
```
Tipo: CNAME
Nome: @ (ou deixar em branco para domínio raiz)
Valor: ogeljmbhqxpfjbpnbwog.supabase.co
TTL: 3600 (ou padrão)
```

**OU**

**2. Registro A (Alternativa):**
```
Tipo: A
Nome: @ (ou deixar em branco)
Valor: [IP do Supabase - obter do Dashboard]
TTL: 3600
```

⚠️ **Nota**: O registro.br pode não permitir CNAME no apex. Nesse caso, use registro A ou configure via Supabase Dashboard.

---

### Opção 2: Subdomínio (Recomendado)

Se você quer usar um subdomínio (ex: `app.seudominio.com.br`):

#### Registro DNS:

```
Tipo: CNAME
Nome: app (ou o subdomínio desejado)
Valor: ogeljmbhqxpfjbpnbwog.supabase.co
TTL: 3600 (ou padrão)
```

**Exemplo:**
- Se seu domínio é `meusite.com.br`
- E você quer usar `app.meusite.com.br`
- Configure: `CNAME app → ogeljmbhqxpfjbpnbwog.supabase.co`

---

## 🚀 Passo a Passo no Registro.br

### 1. Acessar o Registro.br

1. Acesse: https://registro.br
2. Faça login na sua conta
3. Vá em **Meus Domínios**
4. Selecione o domínio que deseja configurar

### 2. Configurar DNS

1. Clique em **DNS** ou **Zona DNS**
2. Clique em **Adicionar Registro** ou **Novo Registro**
3. Configure conforme uma das opções acima

### 3. Exemplo de Configuração Completa

**Para subdomínio `app.seudominio.com.br`:**

```
Tipo: CNAME
Nome: app
Valor: ogeljmbhqxpfjbpnbwog.supabase.co
TTL: 3600
Prioridade: (deixar em branco ou 0)
```

---

## ⚙️ Configurar no Supabase Dashboard

Após configurar o DNS, você precisa adicionar o domínio no Supabase:

### Passo 1: Acessar Configurações

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
2. Vá em **Settings** → **Custom Domains**

### Passo 2: Adicionar Domínio

1. Clique em **Add Domain**
2. Digite seu domínio (ex: `app.seudominio.com.br`)
3. Clique em **Add Domain**
4. O Supabase irá verificar o DNS

### Passo 3: Verificar DNS

O Supabase mostrará os registros DNS necessários. Verifique se correspondem ao que você configurou no registro.br.

---

## 🔍 Verificar Configuração DNS

Após configurar, aguarde a propagação DNS (pode levar até 48 horas, geralmente 1-2 horas):

### Verificar via Terminal:

```bash
# Verificar CNAME
dig app.seudominio.com.br CNAME

# Verificar A
dig app.seudominio.com.br A

# Verificar propagação
nslookup app.seudominio.com.br
```

### Verificar Online:

- https://dnschecker.org
- https://www.whatsmydns.net

---

## 📝 Exemplos de Configuração

### Exemplo 1: Subdomínio `app`

```
Domínio: meusite.com.br
Subdomínio desejado: app.meusite.com.br

DNS no registro.br:
Tipo: CNAME
Nome: app
Valor: ogeljmbhqxpfjbpnbwog.supabase.co
```

### Exemplo 2: Subdomínio `api`

```
Domínio: meusite.com.br
Subdomínio desejado: api.meusite.com.br

DNS no registro.br:
Tipo: CNAME
Nome: api
Valor: ogeljmbhqxpfjbpnbwog.supabase.co
```

### Exemplo 3: Subdomínio `supabase`

```
Domínio: meusite.com.br
Subdomínio desejado: supabase.meusite.com.br

DNS no registro.br:
Tipo: CNAME
Nome: supabase
Valor: ogeljmbhqxpfjbpnbwog.supabase.co
```

---

## ⚠️ Observações Importantes

### 1. Domínio Apex (Raiz)

- O registro.br **pode não permitir CNAME** no domínio raiz
- Nesse caso, use registro **A** ou configure via Supabase Dashboard
- O Supabase fornecerá o IP correto no Dashboard

### 2. SSL/TLS

- O Supabase configura automaticamente SSL/TLS (HTTPS)
- Após a propagação DNS, o certificado será emitido automaticamente
- Pode levar algumas horas para o certificado ser emitido

### 3. Propagação DNS

- DNS pode levar de **1 hora a 48 horas** para propagar
- Geralmente leva **1-2 horas** no Brasil
- Use ferramentas de verificação para acompanhar

### 4. Múltiplos Domínios

- Você pode configurar múltiplos subdomínios
- Cada um aponta para o mesmo projeto Supabase
- Configure cada um separadamente no registro.br

---

## 🔐 Configuração de SSL

Após configurar o DNS:

1. O Supabase detecta automaticamente o domínio
2. Emite certificado SSL via Let's Encrypt
3. Pode levar algumas horas para ativar
4. Você verá o status no Dashboard

---

## 📊 Verificar Status no Supabase

1. Acesse: **Settings** → **Custom Domains**
2. Verifique o status do domínio:
   - ✅ **Active**: Domínio funcionando
   - ⏳ **Pending**: Aguardando verificação DNS
   - ❌ **Error**: Erro na configuração DNS

---

## 🆘 Troubleshooting

### Problema: DNS não está propagando

**Solução:**
- Aguarde até 48 horas
- Verifique se o registro está correto
- Limpe cache DNS: `ipconfig /flushdns` (Windows) ou `sudo dscacheutil -flushcache` (Mac)

### Problema: Certificado SSL não está sendo emitido

**Solução:**
- Aguarde algumas horas após DNS propagar
- Verifique se o domínio está acessível
- Entre em contato com suporte Supabase se persistir

### Problema: Erro "Domain verification failed"

**Solução:**
- Verifique se o DNS está configurado corretamente
- Aguarde propagação completa
- Verifique se o valor do CNAME está correto

---

## 📞 Suporte

- **Registro.br**: https://registro.br/atendimento
- **Supabase**: https://supabase.com/support

---

**Última atualização**: 15/12/2025 01:50



